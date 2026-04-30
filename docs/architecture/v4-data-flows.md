# V4 Data Flows

**Sequence diagrams and data flow specifications for the V4 enterprise data platform.**

---

## Overview

V4 introduces five new data flows that extend V3's existing WCP analysis pipeline. All flows are additive — V3's analyze → validate → verdict → persist pipeline continues unchanged.

| # | Flow | Trigger | Key Technologies |
|---|---|---|---|
| 1 | Scheduled DBWD Rate Refresh | Prefect cron (daily 06:00) | Prefect, Great Expectations, PostgreSQL |
| 2 | Real-Time Decision Streaming | Decision persist event | Redis Streams, SSE, React |
| 3 | Analytics Query | HTTP request from React | DuckDB, PostgreSQL, Parquet |
| 4 | Bulk Contract/Payroll Ingestion | User upload (CSV/PDF) | Prefect, Great Expectations, PostgreSQL partitioning |
| 5 | Enterprise Connector Sync | Prefect cron (configurable) | Connector framework, SFTP/API/DB |

---

## Flow 1: Scheduled DBWD Rate Refresh (Prefect)

**Trigger:** Daily at 06:00 via Prefect schedule  
**Purpose:** Keep prevailing wage rates current by fetching from SAM.gov API  
**Owner:** `backend/src/wcp_backend/pipelines/dbwd_refresh.py`

```
Daily 06:00 (Prefect schedule)
         │
         ▼
┌──────────────────────────────────────┐
│  Step 1: fetch_sam_gov_rates         │
│  Prefect Task (retries=3,            │
│    retry_delay_seconds=300)          │
│                                      │
│  Input:  date_range = today          │
│  Action: GET SAM.gov API             │
│          Parse response              │
│  Output: list[DBWDRate]              │
│  Duration: ~10-30s                   │
└───────────────┬──────────────────────┘
                │
                ▼
┌──────────────────────────────────────┐
│  Step 2: validate_rates              │
│  Great Expectations suite            │
│                                      │
│  Expectations:                       │
│  ✓ No nulls in rate, fringe, trade   │
│  ✓ Rate within ±20% of existing     │
│  ✓ All trade codes in valid set     │
│  ✓ Fringe >= 0                      │
│  ✓ effective_date is current         │
│                                      │
│  Duration: ~1s                       │
└───────────────┬──────────────────────┘
                │
          ┌─────┴──────┐
          ▼            ▼
     ┌────────┐   ┌──────────┐
     │  PASS  │   │  FAIL    │
     │        │   │          │
     │        │   │  Action: │
     │        │   │  1. Alert via Prefect notification │
     │        │   │  2. Quarantine failed records      │
     │        │   │  3. Log to ingestion_jobs          │
     │        │   │  4. Human review flag              │
     └───┬────┘   └──────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  Step 3: load_rates                  │
│  UPSERT to PostgreSQL dbwd_rates     │
│                                      │
│  INSERT ... ON CONFLICT              │
│    (trade, locality, effective_date) │
│  DO UPDATE SET rate = EXCLUDED.rate  │
│                                      │
│  Duration: ~2-5s                     │
└───────────────┬──────────────────────┘
                │
                ▼
┌──────────────────────────────────────┐
│  Step 4: export_to_parquet           │
│  Append to archive/rates/YYYY-MM.parquet │
│                                      │
│  Duration: ~1s                       │
└───────────────┬──────────────────────┘
                │
                ▼
┌──────────────────────────────────────┐
│  Step 5: refresh_cache               │
│  Redis cache invalidation for        │
│  updated trade/locality combos       │
│                                      │
│  Duration: ~0.1s                     │
└──────────────────────────────────────┘
```

**Prefect Flow Definition:**

```python
# backend/src/wcp_backend/pipelines/dbwd_refresh.py
from prefect import flow, task
from datetime import timedelta

@task(retries=3, retry_delay_seconds=300)
async def fetch_sam_gov_rates(date_range: str) -> list[dict]:
    ...

@task
async def validate_rates(rates: list[dict]) -> tuple[list[dict], list[dict]]:
    ...

@task
async def load_rates(valid_rates: list[dict]) -> int:
    ...

@task
async def export_to_parquet(valid_rates: list[dict]) -> str:
    ...

@task
async def refresh_cache(updated_trades: list[str]) -> None:
    ...

@flow(name="dbwd-rate-refresh")
async def dbwd_refresh_flow():
    rates = await fetch_sam_gov_rates("today")
    valid, failed = await validate_rates(rates)
    if failed:
        logger.error(f" Quarantined {len(failed)} invalid rates")
    count = await load_rates(valid)
    path = await export_to_parquet(valid)
    await refresh_cache([r["trade"] for r in valid])
    return {"loaded": count, "path": path, "quarantined": len(failed)}
```

**Error Handling:**

| Failure Point | Action | User Impact |
|---|---|---|
| SAM.gov API unreachable | Prefect retries 3x with 5-min backoff | No impact — existing rates still cached |
| Validation failure | Quarantine + alert + human review | No bad data loaded |
| PostgreSQL UPSERT fails | Prefect retry | Rate update delayed |
| Parquet export fails | Alert only (non-blocking) | Archive gap, filled on next run |

---

## Flow 2: Real-Time Decision Streaming (Redis Streams)

**Trigger:** Every decision persist event  
**Purpose:** Push real-time decision updates to analytics dashboard  
**Owner:** `backend/src/wcp_backend/events/producer.py` → `agent/src/events/consumer.ts` → `frontend/src/pages/analytics/`

```
V3 Backend (on decision persist)
         │
         │  After: services/audit.py saves to decisions table
         │
         ▼
┌──────────────────────────────────────────────┐
│  events/producer.py                          │
│  emit_decision_event(decision)               │
│                                              │
│  event = DecisionEvent(                      │
│    decision_id=decision.id,                  │
│    contract_id=decision.contract_id,         │
│    status=decision.verdict,                  │
│    trust_score=decision.trust_score,         │
│    trust_band=decision.trust_band,           │
│    trade=extracted.trade_code,               │
│    locality=extracted.locality_code,         │
│    violation_count=decision.violation_count, │
│    model_used=decision.model,                │
│    cost_usd=decision.cost_usd,               │
│    latency_ms=decision.latency_ms,           │
│    timestamp=datetime.utcnow()               │
│  )                                           │
│                                              │
│  await redis.xadd(                           │
│    "decisions:stream",                       │
│    {"data": event.model_dump_json()},        │
│    maxlen=100000                             │
│  )                                           │
│                                              │
│  Latency: < 1ms                              │
└──────────────┬───────────────────────────────┘
               │
               ▼
         Redis Stream
         "decisions:stream"
               │
    ┌──────────┴──────────┐
    ▼                     ▼
┌───────────────┐  ┌───────────────┐
│ Consumer 1:   │  │ Consumer 2:   │
│ Agent Gateway │  │ Analytics     │
│               │  │ DuckDB Rollup │
│ XREADGROUP    │  │               │
│ group:        │  │ Periodic      │
│  "agent-sse"  │  │ batch insert  │
│ consumer:     │  │ to DuckDB     │
│  "agent-1"    │  │ local tables  │
└───────┬───────┘  └───────────────┘
        │
        ▼
┌───────────────────────┐
│  events/sse.ts        │
│                       │
│  SSE push to          │
│  connected React      │
│  clients              │
│                       │
│  Connected clients    │
│  receive event in     │
│  < 500ms from persist │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────────────────┐
│  React Analytics Dashboard        │
│                                   │
│  useEffect with EventSource:      │
│  const es = new EventSource(      │
│    '/api/events/subscribe'        │
│  );                               │
│  es.onmessage = (e) => {          │
│    const event = JSON.parse(      │
│      e.data                       │
│    );                             │
│    // Update Recharts live        │
│    addDataPoint(event);           │
│  };                               │
└───────────────────────────────────┘
```

**Consumer Group Configuration:**

```typescript
// agent/src/events/consumer.ts
import { createClient } from "redis";

const consumer = createClient({ url: process.env.REDIS_URL });
await consumer.connect();

// Create consumer group (idempotent)
try {
  await consumer.xGroupCreate("decisions:stream", "agent-sse", "0", { MKSTREAM: true });
} catch (e) {
  // Group already exists
}

// Read new messages
while (true) {
  const messages = await consumer.xReadGroup(
    "GROUP", "agent-sse", "agent-1",
    "BLOCK", 5000,
    "COUNT", 10,
    "STREAMS", "decisions:stream", ">"
  );

  for (const msg of messages?.[0]?.messages ?? []) {
    const event = JSON.parse(msg.message.data);
    pushToSSEClients(event);
    await consumer.xAck("decisions:stream", "agent-sse", msg.id);
  }
}
```

**Latency Targets:**

| Segment | Target | Measurement |
|---|---|---|
| PostgreSQL persist → Redis XADD | < 1ms | Backend instrumentation |
| Redis → Agent consumer read | < 50ms | Consumer group monitoring |
| Agent → SSE push to React | < 200ms | Frontend EventSource latency |
| **Total: persist → dashboard** | **< 500ms** | End-to-end timing |

---

## Flow 3: Analytics Query (DuckDB)

**Trigger:** HTTP request from React analytics page  
**Purpose:** Fast cross-contract analytical queries over millions of decisions  
**Owner:** `backend/src/wcp_backend/analytics/`

```
React Analytics Page
         │
         │  GET /api/analytics/decision-volume?period=30d
         │
         ▼
┌────────────────────────────────────────────────┐
│  Agent Gateway                                 │
│  v4-analytics.ts                               │
│                                                │
│  Proxy to backend: GET /analytics/...          │
│  Add auth context (contractor_id from JWT)     │
│  Response caching: 60s stale-while-revalidate  │
└───────────────┬────────────────────────────────┘
                │
                ▼
┌────────────────────────────────────────────────┐
│  Backend analytics/router.py                   │
│  GET /analytics/decision-volume                │
│                                                │
│  Query params: period=30d | 90d | 365d        │
│                contract_id (optional filter)    │
└───────────────┬────────────────────────────────┘
                │
                ▼
┌────────────────────────────────────────────────┐
│  analytics/queries.py                          │
│                                                │
│  DuckDB SQL query:                             │
│                                                │
│  SELECT                                        │
│    DATE_TRUNC('day', created_at) AS date,      │
│    COUNT(*) AS decisions,                      │
│    AVG(trust_score) AS avg_trust,              │
│    COUNT(CASE WHEN verdict = 'Approved'        │
│      THEN 1 END) * 100.0 / COUNT(*)            │
│      AS approval_rate                          │
│  FROM v_all_decisions                          │
│  WHERE created_at > CURRENT_DATE - INTERVAL    │
│    '{period_days}' DAY                         │
│  GROUP BY 1                                    │
│  ORDER BY 1                                    │
│                                                │
│  v_all_decisions = UNION of:                   │
│    - v_decisions (live PostgreSQL)             │
│    - v_decisions_archive (Parquet files)        │
│                                                │
│  Duration: < 2s for millions of rows           │
└───────────────┬────────────────────────────────┘
                │
                ▼
┌────────────────────────────────────────────────┐
│  DuckDB Engine (in-process)                    │
│                                                │
│  Two data sources:                             │
│                                                │
│  1. postgres_scan():                           │
│     Reads directly from PostgreSQL tables       │
│     (no data duplication)                      │
│                                                │
│  2. read_parquet():                            │
│     Reads columnar Parquet files                │
│     (time-partitioned, compressed)             │
│                                                │
│  DuckDB merges both sources transparently      │
│  via the v_all_decisions UNION ALL view        │
└───────────────┬────────────────────────────────┘
                │
                ▼
┌────────────────────────────────────────────────┐
│  Response JSON                                 │
│                                                │
│  [                                             │
│    {"date": "2025-01-15", "decisions": 42,     │
│     "avg_trust": 0.87, "approval_rate": 85.7}, │
│    {"date": "2025-01-16", "decisions": 38, ... │
│  ]                                             │
│                                                │
│  Cached in Agent for 60s                       │
│  → Recharts DecisionVolumeChart                │
└────────────────────────────────────────────────┘
```

**DuckDB Query Performance:**

| Query | Data Size | DuckDB Time | PostgreSQL Time |
|---|---|---|---|
| Daily decision volume (30d) | 1M rows | ~500ms | ~15s |
| Approval rate by trade | 1M rows | ~800ms | ~20s |
| Wage violation trend (365d) | 5M rows | ~2s | ~60s |
| LLM cost per day | 1M rows | ~300ms | ~10s |

**Why DuckDB is 10-100x faster:** Columnar storage reads only needed columns. Vectorized execution processes batches of rows simultaneously. PostgreSQL row-based storage must read entire rows even for 2-column aggregations.

---

## Flow 4: Bulk Contract/Payroll Ingestion

**Trigger:** User uploads CSV/PDF via `/api/bulk-upload`  
**Purpose:** Import thousands of contracts and payroll records in a single batch  
**Owner:** `backend/src/wcp_backend/ingestion/processor.py`

```
Frontend: /ingestion page
         │
         │  POST /api/bulk-upload
         │  Content-Type: multipart/form-data
         │  Body: CSV file (10,000 rows)
         │  + metadata: {type: "payroll_import", contract_id: "abc"}
         │
         ▼
┌────────────────────────────────────────────────┐
│  Agent Gateway                                 │
│  v4-ingestion.ts                               │
│                                                │
│  1. Validate file type (CSV/PDF only)          │
│  2. Check file size (< 50MB)                   │
│  3. Forward to backend with auth context       │
└───────────────┬────────────────────────────────┘
                │
                ▼
┌────────────────────────────────────────────────┐
│  Backend ingestion/router.py                   │
│  POST /ingestion/bulk-upload                   │
│                                                │
│  1. Create ingestion_jobs record               │
│     status='pending', total_records=0          │
│                                                │
│  2. Save uploaded file to temp storage         │
│                                                │
│  3. Enqueue Prefect/Celery task                │
│     Return: {job_id, status: 'pending'}        │
└───────────────┬────────────────────────────────┘
                │
                ▼
┌────────────────────────────────────────────────┐
│  ingestion/processor.py (async task)           │
│                                                │
│  Step 1: Parse file                            │
│  ├── CSV: pandas/csv.reader row-by-row         │
│  └── PDF: V3's pdfplumber extraction           │
│  Output: list[dict]                            │
│  Duration: ~5-30s depending on file size       │
│                                                │
│  Step 2: Schema validation                     │
│  └── Pydantic model validation per record      │
│  Output: valid_records[], invalid_records[]    │
│                                                │
│  Step 3: Great Expectations suite              │
│  └── payroll_expectations.py                   │
│      ✓ Wage ranges valid (min/max per trade)   │
│      ✓ Hours <= 24 per day                     │
│      ✓ Trade codes in valid set                │
│      ✓ No duplicate employee+week combinations │
│  Output: passed_records[], failed_records[]    │
└───────────────┬────────────────────────────────┘
                │
                ▼
┌────────────────────────────────────────────────┐
│  Step 4: Database write                        │
│                                                │
│  4a. Ensure partition exists:                  │
│      CREATE TABLE IF NOT EXISTS                │
│        payroll_records_contract_{id}           │
│      PARTITION OF payroll_records              │
│        FOR VALUES IN ('{contract_id}')         │
│                                                │
│  4b. Batch INSERT (1000 rows/batch):           │
│      INSERT INTO payroll_records ...           │
│      ON CONFLICT DO NOTHING                    │
│                                                │
│  4c. Update ingestion_jobs:                    │
│      processed_records += batch_size           │
│      status = 'processing'                     │
│                                                │
│  Duration: ~2-5s per 1000 rows                 │
└───────────────┬────────────────────────────────┘
                │
                ▼
┌────────────────────────────────────────────────┐
│  Step 5: Trigger analysis (optional)           │
│                                                │
│  For each new payroll record:                  │
│  → POST /api/analyze-pdf (via V3 pipeline)    │
│  → Decision created and linked to payroll      │
│  → DecisionEvent emitted to Redis Stream       │
│                                                │
│  This step is async and non-blocking.          │
│  Ingestion job is marked 'completed'           │
│  before analysis finishes.                     │
└───────────────┬────────────────────────────────┘
                │
                ▼
┌────────────────────────────────────────────────┐
│  Final: ingestion_jobs updated                 │
│                                                │
│  status = 'completed' | 'partial'              │
│  total_records = 10000                         │
│  processed_records = 9850                      │
│  failed_records = 150                          │
│  error_details = [                             │
│    {row: 42, error: "invalid trade_code"},     │
│    {row: 108, error: "hours > 24"},            │
│    ...                                         │
│  ]                                             │
│  completed_at = NOW()                          │
└────────────────────────────────────────────────┘
```

**Error Handling:**

| Failure | Action | Record Impact |
|---|---|---|
| File parse error (bad CSV) | Reject entire upload, return error to user | 0 records processed |
| Individual record validation fails | Skip record, log to error_details | Valid records still processed |
| GE suite fails | Quarantine batch, alert for review | No records loaded |
| Database write fails | Prefect retry with batch split | Partial retry |
| Partition creation fails | Create partition first, retry | Delayed but complete |

**Frontend polling:**

```typescript
// Frontend: /ingestion page polls for job status
const { data } = useQuery({
  queryKey: ["ingestion", jobId],
  queryFn: () => fetch(`/api/ingestion/status/${jobId}`).then(r => r.json()),
  refetchInterval: (data) => data?.status === "completed" || data?.status === "failed" ? false : 2000,
});
```

---

## Flow 5: Enterprise Connector Sync

**Trigger:** Prefect cron (per-connector schedule)  
**Purpose:** Pull data from external ERP/HR systems into V4  
**Owner:** `backend/src/wcp_backend/connectors/`  
**Note:** V4.1 scope — framework is designed, specific connectors added incrementally

```
Prefect schedule (per connector config)
         │
         │  e.g., "0 */6 * * *" (every 6 hours)
         │
         ▼
┌────────────────────────────────────────────────┐
│  Step 1: Load connector config                 │
│                                                │
│  SELECT * FROM connector_configs               │
│  WHERE name = '{connector_name}'               │
│    AND is_active = TRUE                        │
│                                                │
│  Returns: type, connection_config, schedule    │
└───────────────┬────────────────────────────────┘
                │
                ▼
┌────────────────────────────────────────────────┐
│  Step 2: Instantiate connector                 │
│                                                │
│  connector = ConnectorRegistry.get(type)       │
│  await connector.connect(connection_config)    │
│                                                │
│  Types:                                        │
│  ├── SFTPConnector  → SSH connect              │
│  ├── APIConnector   → HTTP auth                │
│  └── DatabaseConnector → DB driver connect     │
└───────────────┬────────────────────────────────┘
                │
                ▼
┌────────────────────────────────────────────────┐
│  Step 3: Fetch data                            │
│                                                │
│  data = await connector.fetch(                 │
│    since=last_sync_at                          │
│  )                                             │
│                                                │
│  SFTP: list files newer than last_sync_at,     │
│        download and parse CSV/PDF              │
│  API:  GET /payrolls?since={last_sync_at}      │
│  DB:   SELECT ... WHERE updated > {last_sync}  │
│                                                │
│  Duration: varies (1-60s depending on volume)  │
└───────────────┬────────────────────────────────┘
                │
                ▼
┌────────────────────────────────────────────────┐
│  Step 4: Validate (Great Expectations)         │
│                                                │
│  Same validation as Flow 4 (bulk ingestion)    │
│  Plus connector-specific checks:               │
│  ✓ Source data format matches expected schema  │
│  ✓ No duplicate records from previous sync     │
│  ✓ Record count within expected range          │
└───────────────┬────────────────────────────────┘
                │
                ▼
┌────────────────────────────────────────────────┐
│  Step 5: Write to database                     │
│                                                │
│  Same batch INSERT as Flow 4                   │
│  Create ingestion_jobs record for tracking     │
│  Update connector_configs.last_sync_at         │
└───────────────┬────────────────────────────────┘
                │
                ▼
┌────────────────────────────────────────────────┐
│  Step 6: Post-processing                       │
│                                                │
│  - Trigger V3 analysis for new payroll records │
│  - Emit ingestion events to Redis Streams      │
│  - Update connector status in DB               │
│                                                │
│  connector_configs:                            │
│    last_sync_at = NOW()                        │
│    last_sync_status = 'success' | 'partial'    │
└────────────────────────────────────────────────┘
```

**Connector Abstract Base Class:**

```python
# backend/src/wcp_backend/connectors/base.py
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any

class BaseConnector(ABC):
    @abstractmethod
    async def connect(self, config: dict[str, Any]) -> None:
        """Establish connection to external system."""
        ...

    @abstractmethod
    async def fetch(self, since: datetime | None = None) -> list[dict]:
        """Fetch records newer than `since` timestamp."""
        ...

    @abstractmethod
    async def validate(self, records: list[dict]) -> tuple[list[dict], list[dict]]:
        """Validate fetched records. Returns (valid, invalid)."""
        ...

    @abstractmethod
    async def disconnect(self) -> None:
        """Clean up connection resources."""
        ...
```

**Error Handling:**

| Failure | Action | Sync Impact |
|---|---|---|
| Connector unreachable | Prefect retry (3x, exponential backoff) | Delayed sync |
| Auth failure | Alert + disable connector | No sync until credentials updated |
| Data format changed | Quarantine + alert | No data loaded, schema drift detected |
| Partial fetch (timeout) | Process what was fetched, log partial | Partial sync |
| Write fails | Retry with batch split | Complete after retry |

---

## Data Flow Cross-Reference

| Flow | Produces | Consumes | Tables Written | Tables Read |
|---|---|---|---|---|
| 1. DBWD Refresh | Updated rates | SAM.gov API | `dbwd_rates` | `dbwd_rates` (for ±20% check) |
| 2. Decision Streaming | SSE events | Redis Stream | (Redis only) | `decisions` |
| 3. Analytics Query | Dashboard data | DuckDB | None (read-only) | `decisions`, `contracts`, Parquet |
| 4. Bulk Ingestion | Payroll records | CSV/PDF upload | `payroll_records`, `ingestion_jobs` | `contracts` |
| 5. Connector Sync | External data | ERP/HR systems | `payroll_records`, `ingestion_jobs`, `connector_configs` | `contracts` |

---

## Related Documentation

- [V4 Data Platform Architecture](v4-data-platform.md) — Module responsibilities
- [V4 Data Model & Schema](v4-data-model.md) — Table definitions and partitioning
- [V4 API Contract](../v4-api-contract.md) — Endpoints that trigger these flows
- [V3/V4 Boundary](../planning/V3_V4_BOUNDARY.md) — Event contract between V3 and V4

---

*Generated: 2026-04-30*
