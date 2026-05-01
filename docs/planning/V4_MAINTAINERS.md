# V4 Maintainer Notes

**Operational guide for V4 MVP. Covers endpoint mappings, upload flows, infrastructure dependencies, and troubleshooting.**

---

## V4 Endpoint Mappings

V4 adds routes to both the Agent Gateway and Python Backend. Frontend calls Agent; Agent proxies to Backend where needed.

### Agent Routes → Backend Routes

| Agent Route | Backend Target | Description |
|---|---|---|
| `GET/POST /api/contracts` | `GET/POST /v4/contracts` | Contract CRUD |
| `GET /api/contracts/:id` | `GET /v4/contracts/:id` | Single contract |
| `POST /api/contracts/bulk` | `POST /v4/contracts/bulk` | CSV bulk import |
| `PUT /api/contracts/:id` | `PUT /v4/contracts/:id` | Update contract |
| `DELETE /api/contracts/:id` | `DELETE /v4/contracts/:id` | Soft-delete |
| `GET /api/payrolls` | `GET /v4/payrolls` | Payroll record list |
| `GET /api/payrolls/:id` | `GET /v4/payrolls/:id` | Single payroll record |
| `POST /api/payrolls/bulk` | `POST /v4/payrolls/bulk` | CSV bulk import |
| `GET /api/ingestion/status/:job_id` | `GET /v4/ingestion/status/:job_id` | ETL job status |
| `GET /api/ingestion/jobs` | `GET /v4/ingestion/jobs` | List ETL jobs |
| `POST /api/bulk-upload` | `POST /v4/ingestion/bulk-upload` | Enterprise upload |
| `GET /api/analytics/decision-volume` | `GET /v4/analytics/decision-volume` | DuckDB time-series |
| `GET /api/analytics/compliance` | `GET /v4/analytics/compliance` | DuckDB compliance |
| `GET /api/analytics/wages` | `GET /v4/analytics/wages` | DuckDB wages |
| `GET /api/analytics/llm` | `GET /v4/analytics/llm` | DuckDB LLM cost |
| `GET /api/analytics/overview` | `GET /v4/analytics/overview` | DuckDB overview |
| `GET /api/events/subscribe` | (Agent internal) | Redis Streams SSE |

### Backend V4 Module Locations

| Module | Path | Key Files |
|---|---|---|
| Contracts | `backend/src/wcp_backend/contracts/` | `router.py`, `models.py`, `service.py`, `schemas.py` |
| Payrolls | `backend/src/wcp_backend/payrolls/` | `router.py`, `models.py`, `service.py`, `schemas.py` |
| Ingestion | `backend/src/wcp_backend/ingestion/` | `router.py`, `processor.py`, `tasks.py`, `schemas.py` |
| Analytics | `backend/src/wcp_backend/analytics/` | `router.py`, `queries.py`, `duckdb_store.py`, `schemas.py` |
| Pipelines | `backend/src/wcp_backend/pipelines/` | `dbwd_refresh.py`, `decision_export.py`, `bulk_ingest.py`, `utils.py` |
| Events | `backend/src/wcp_backend/events/` | `producer.py`, `schemas.py` |
| Quality | `backend/src/wcp_backend/quality/` | `dbwd_expectations.py`, `contract_expectations.py`, `payroll_expectations.py` |
| Storage | `backend/src/wcp_backend/storage/` | `parquet_writer.py`, `duckdb_init.py` |
| Connectors | `backend/src/wcp_backend/connectors/` | `base.py`, `sftp.py`, `api_client.py`, `database.py`, `registry.py` |

---

## Contract Upload Flow

### Step-by-Step

1. **Prepare CSV** with required columns: `contract_number, project_name, contractor_name, contractor_ein, agency, locality, start_date, end_date, total_value`

2. **Upload via Agent**:
   ```bash
   curl -X POST http://localhost:3000/api/contracts/bulk \
     -H "Authorization: Bearer $JWT_TOKEN" \
     -F "file=@contracts_batch.csv"
   ```

3. **Backend processes**:
   - `ingestion/router.py` receives the CSV
   - `ingestion/processor.py` parses and validates each row
   - `quality/` GE suite runs (contract_expectations.py) — quarantine on failure
   - `contracts/service.py` bulk_upsert() writes to DB
   - Returns job_id for status polling

4. **Poll job status**:
   ```bash
   curl http://localhost:3000/api/ingestion/status/$JOB_ID \
     -H "Authorization: Bearer $JWT_TOKEN"
   ```

5. **Response format** (when complete):
   ```json
   {
     "job_id": "ingest-789",
     "status": "completed",
     "total_records": 1000,
     "processed_records": 985,
     "failed_records": 15,
     "error_details": [
       {"row": 42, "error": "invalid trade_code: 'ELECTRICIAN' (expected 'ELEC')"},
       {"row": 108, "error": "total_value is not a number"}
     ]
   }
   ```

### Single Contract via JSON
```bash
curl -X POST http://localhost:3000/api/contracts \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "contract_number": "GS-10P-2025-001",
    "project_name": "Federal Building HVAC Upgrade",
    "contractor_name": "Acme Mechanical Inc.",
    "contractor_ein": "12-3456789",
    "agency": "GSA",
    "locality": "Boston, MA",
    "start_date": "2025-01-15",
    "end_date": "2026-06-30",
    "total_value": 2500000.00,
    "source": "manual"
  }'
```

---

## Payroll Upload Flow

### Step-by-Step

1. **Ensure contract exists** (contract_id required for payroll import)

2. **Prepare CSV** with columns: `employee_name, trade_code, week_ending, hours_worked, hourly_rate, gross_pay, overtime_hours, fringe_benefits`

3. **Upload**:
   ```bash
   curl -X POST http://localhost:3000/api/payrolls/bulk \
     -H "Authorization: Bearer $JWT_TOKEN" \
     -F "file=@payroll_april.csv" \
     -F "contract_id=abc-123"
   ```

4. **Backend processes**:
   - `ingestion/router.py` parses CSV + contract_id
   - `payrolls/service.py` creates partitioned records
   - `quality/payroll_expectations.py` validates wage ranges, hours limits
   - On GE failure: record quarantined, job marked `partial`

5. **Poll**:
   ```bash
   curl http://localhost:3000/api/ingestion/status/$JOB_ID \
     -H "Authorization: Bearer $JWT_TOKEN"
   ```

---

## Analytics Query Flow

DuckDB analytics queries are proxied: Frontend → Agent → Backend (`/analytics/*`).

### Example: Decision Volume
```bash
curl "http://localhost:3000/api/analytics/decision-volume?period=30d&granularity=day" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### Example: Compliance Breakdown
```bash
curl "http://localhost:3000/api/analytics/compliance?period=90d" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

DuckDB reads from both PostgreSQL (live data) and Parquet archives. If DuckDB is unavailable, analytics endpoints return empty datasets with HTTP 200.

---

## Real-Time Event Flow

1. **Backend** (`events/producer.py`) emits `XADD decisions:stream` after each decision persist
2. **Agent** (`events/consumer.ts`) runs `XREADGROUP` in a background loop
3. **Frontend** subscribes via `GET /api/events/subscribe` (SSE)
4. Events delivered as SSE: `event: decision\n data: {...}`

```bash
# Subscribe to live events
curl -N http://localhost:3000/api/events/subscribe \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Accept: text/event-stream"
```

Requires Redis 7+ with consumer group `wcp-events-group` created on startup.

---

## Infrastructure Troubleshooting

### PostgreSQL

| Symptom | Likely Cause | Fix |
|---|---|---|
| `connection refused` on port 5432 | PostgreSQL not running | `sudo systemctl start postgresql` |
| `partition "payroll_records_2025" does not exist` | Partition not created | Auto-created on payroll bulk import; check `payrolls/service.py` partition logic |
| `permission denied for table contracts` | Migration not run | `poetry run alembic upgrade head` |
| pgvector extension missing | Extension not created | `CREATE EXTENSION IF NOT EXISTS vector;` |
| Slow queries on payroll_records | Missing index | Check `payrolls/models.py` for indexes on `contract_id`, `week_ending` |

### Redis

| Symptom | Likely Cause | Fix |
|---|---|---|
| `NOREDIRECT` on XREADGROUP | Consumer group not created | Initialize via `events/consumer.ts` startup or manual `XGROUP CREATE` |
| Events not streaming | Redis Streams not enabled | Verify Redis 7+; `redis-cli INFO` shows `redis_version` |
| `WRONGTYPE` error | Key exists with wrong type | Delete key: `redis-cli DEL decisions:stream` (loses pending messages) |

### DuckDB

| Symptom | Likely Cause | Fix |
|---|---|---|
| `Catalog Error: table does not exist` | `duckdb_init.py` not run | Initialize views on startup: `poetry run python -c "from wcp_backend.storage.duckdb_init import init_views; init_views()"` |
| Slow cross-contract queries | Full table scan | Verify Parquet partition pruning; check `analytics/queries.py` for proper date filters |
| `IO Error: No such file` on Parquet read | Archive path wrong | Set `PARQUET_ARCHIVE_PATH` env var; default `data/archive/decisions/` |

### Prefect

| Symptom | Likely Cause | Fix |
|---|---|---|
| `ModuleNotFoundError: prefect` | Prefect not installed | `poetry install` from backend/ |
| Flows not showing in Prefect UI | Worker not started | `poetry run python -m prefect worker start` |
| `Deployment not found` | Deployment not created | `poetry run python -m prefect deploy` (run from backend/) |
| Flow run stuck in `Pending` | No worker polling | Start a Prefect worker: `poetry run python -m prefect worker start -p default-agent-pool` |

### Great Expectations

| Symptom | Likely Cause | Fix |
|---|---|---|
| Ingestion never quarantines records | GE not integrated | Verify `ingestion/processor.py` calls `quality/` suite before DB insert |
| `ge data context not found` | Gx not initialized | GE uses in-code `gxb.from_directory()`; check `quality/` module initialization |
| All records pass GE but data is wrong | GE expectations too loose | Tighten ranges in `quality/*.py` suites; run `pytest tests/unit/test_quality.py` to validate |

### General

| Symptom | Likely Cause | Fix |
|---|---|---|
| Slow agent startup | env file not loaded | Copy `.env.example` → `.env` in agent/ |
| CORS errors in frontend | Wrong origin | Set `CORS_ORIGINS` env var; dev default `http://localhost:5173` |
| 502 from agent | Backend unreachable | Check `BACKEND_URL` env var in agent; default `http://localhost:8000` |
| 401 on all requests | JWT expired or missing | Login: `POST /api/auth/login` returns 1h JWT; check `JWT_SECRET` match |

---

## V3/V4 Boundary Notes

**No V3 source files are modified.** V4 integration points:

1. **Database**: V4 reads V3 `decisions` table (read-only). V4 owns `contracts`, `payroll_records`, `ingestion_jobs`, `connector_configs`.
2. **Event emission**: `events/producer.py` post-commit hook on V3 audit persist — V3 audit service unchanged.
3. **API routing**: Agent V4 routes are separate Hono router files in `agent/src/api/v4/`. V3 route files (`analyze.ts`, `decisions.ts`, etc.) are untouched.
4. **Redis Streams**: V4 uses same Redis instance; adds `decisions:stream` key. V3 Redis usage (Celery, DBWD cache) unaffected.

**Route registration is additive**: V4 routes are registered in `agent/src/api/v4/index.ts` and mounted on the Hono app alongside V3 routes. No V3 route file is modified to add V4 routes.

---

## Key Environment Variables

### Backend (V4)

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | (required) | PostgreSQL connection |
| `REDIS_URL` | (required) | Redis connection |
| `DUCKDB_PATH` | `data/duckdb/wcp_analytics.duckdb` | Local DuckDB file |
| `PARQUET_ARCHIVE_PATH` | `data/archive/decisions/` | Parquet archive directory |
| `PREFECT_API_URL` | `http://localhost:4200/api` | Prefect Orion API |
| `OPENAI_API_KEY` | (required for real LLM) | OpenAI API key |

### Agent (V4)

| Variable | Default | Description |
|---|---|---|
| `BACKEND_URL` | `http://localhost:8000` | Backend base URL |
| `JWT_SECRET` | (required) | JWT signing secret |
| `AUTH_DISABLED` | `false` | Disable auth (dev only) |

---

*Last updated: 2026-05-01*
*V4 MVP — WCP Compliance Agent V3/V4*
