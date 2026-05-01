# V4 Plan: Data Platform Layer

**Extending V3 from individual document processing to full-scale contract/payroll database platform.**

---

## Philosophy

**V4 is not a rewrite — it's built on top of V3.**

Unlike V3 (which was a ground-up rewrite of V2), V4 extends V3's existing architecture. All V3 components remain unchanged and operational. V4 adds new modules, new data flows, and new scale — but the core AI system (RAG, agents, validation, evaluation) stays exactly as built in V3.

**V3** handles multi-document uploads (batches of 10-100 WCPs) with async Celery processing. Suitable for contractor-level workloads: weekly payroll batches, monthly reporting, demo-scale databases with thousands of records.

**V4** adds enterprise-scale capabilities **on top of V3**:
- **Scale jump:** From thousands to millions of payroll records (PostgreSQL partitioning)
- **Persistence:** Contract/payroll tables with full CRUD (vs. transient job results in V3)
- **Historical depth:** Multi-year payroll database with full search (vs. current batch only)
- **Enterprise integration:** Middleware connectors to ERP/HR systems (SFTP, APIs, direct DB)
- **Analytics:** Cross-contract OLAP with DuckDB (reading from the same PostgreSQL)
- **New management pages:** `/contracts`, `/payrolls`, `/ingestion` alongside existing `/analyze`

V3's multi-document upload continues working exactly as built. V4 adds enterprise data management on top.

Every decision is a data point. Accumulated decisions across thousands of contracts become training data, trend signals, and predictive indicators. The AI improves the data; the data improves the AI.

---

## V4 Architecture Overview

**V4 layers new capabilities on top of V3's existing architecture.** All V3 services, endpoints, and workflows remain unchanged.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  REACT 19 FRONTEND — V4 EXTENDS V3                                          │
│  V3 pages (unchanged): /analyze, /decisions, /review, /settings              │
│                                                                             │
│  V4 NEW pages (additive):                                                   │
│  • /contracts — bulk contract management (upload 1000s)                    │
│  • /payrolls — payroll database browser & search                           │
│  • /ingestion — ETL job monitoring and data source management                │
│  • /analytics/* — cross-contract analytics dashboard (Recharts)              │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                    │ HTTP / REST + SSE
                                    │
┌───────────────────────────────────▼─────────────────────────────────────────┐
│  AGENT GATEWAY — V3 CORE + V4 EXTENSIONS                                    │
│                                                                             │
│  V3 (unchanged):                                                            │
│  • Multi-document upload (/api/analyze-pdf) — batches of 10-100 WCPs       │
│  • Async Celery processing for batch workflows                              │
│  • Individual WCP analysis via Mastra agents                                │
│                                                                             │
│  V4 NEW (additive):                                                         │
│  • Enterprise bulk ingestion (/api/bulk-upload) — thousands via CSV/PDF     │
│  • Connection management — external ERP/HR system connectors               │
│  • Redis Streams consumer — real-time decision feed across all contracts   │
│  • Multi-LLM router — OpenAI ↔ Anthropic ↔ Ollama                          │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ REST + SSE
                                    │
┌───────────────────────────────────▼─────────────────────────────────────────┐
│  PYTHON BACKEND — V3 CORE + V4 EXTENSIONS                                   │
│                                                                             │
│  V3 CORE (unchanged, still operational):                                   │
│  ├─ pipeline/     Deterministic extraction, validation (V3)                 │
│  ├─ retrieval/    Hybrid RAG — BM25 + vector + rerank (V3)                    │
│  └─ services/     DB (PostgreSQL), cache (Redis), Celery tasks (V3)         │
│                                                                             │
│  V4 NEW MODULES (additive):                                                 │
│  ├─ contracts/    Contract database management (CRUD + bulk import)          │
│  ├─ payrolls/     Payroll record storage, historical search                  │
│  ├─ ingestion/    Bulk document processors, batch pipelines                │
│  ├─ connectors/   ERP/HR system connectors (extensibility framework)         │
│  ├─ analytics/    DuckDB OLAP queries → API endpoints                      │
│  ├─ pipelines/    Prefect ETL flows (DBWD refresh + bulk processing)       │
│  ├─ events/       Redis Streams producer (decision events)                   │
│  ├─ quality/      Great Expectations suites                                │
│  └─ storage/      Parquet export, DuckDB integration                       │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
┌───────────────────────────────────┼─────────────────────────────────────────┐
│                                   │                                       │
│  ┌────────────────────────┐       │      ┌───────────────────────────┐     │
│  │ EXTERNAL DATA SOURCES  │       │      │  DATA PLATFORM LAYER      │     │
│  │  (V4 Middleware Layer)│       │      │                           │     │
│  ├────────────────────────┤       │      │ ┌─────────────────────┐   │     │
│  │ • SFTP drops (CSV bulk)│       │      │ │ DuckDB (in-process) │   │     │
│  │ • Contract Mgmt APIs   │       │      │ │ OLAP analytics      │   │     │
│  │ • ERP/HR system APIs   │       │      │ └─────────────────────┘   │     │
│  │ • Direct DB connections│◄──────┘      │ ┌─────────────────────┐   │     │
│  │   (read replicas, etc) │              │ │ Apache Parquet      │   │     │
│  │ • File shares (PDFs)   │              │ │ Archive storage     │   │     │
│  └────────────────────────┘              │ └─────────────────────┘   │     │
│                                           └───────────────────────────┘     │
│                                                                             │
│  ┌────────────────────────┐  ┌──────────────────┐                           │
│  │  PostgreSQL 16         │  │  Redis 7         │                           │
│  │  + pgvector            │  │  + Streams       │                           │
│  │                        │  │                  │                           │
│  │  Operational data:     │  │  Events:         │                           │
│  │  decisions, audits,    │  │  decisions:      │                           │
│  │  jobs, DBWD rates      │  │  stream          │                           │
│  │  + contracts table     │  │                  │                           │
│  │  + payrolls table      │  │  Cache:          │                           │
│  │  (millions of rows)    │  │  DBWD rates      │                           │
│  └────────────────────────┘  └──────────────────┘                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                         ┌──────────────────┐
                         │  Apache Parquet │
                         │  Archive:       │
                         │  historical     │
                         │  decision       │
                         │  exports        │
                         └──────────────────┘
```

---

## V4 Tech Stack

| Layer | Technology | Architectural Purpose |
|---|---|---|
| **Database Scale** | PostgreSQL 16 + partitioning | V3: demo-scale. V4: millions of payroll records, partitioned by contract_id + date for query performance. |
| **Analytics Engine** | DuckDB | In-process OLAP: 10-100× faster than PostgreSQL for analytical queries. Reads live PostgreSQL + Parquet. No extra server. |
| **Data Format** | Apache Parquet | Columnar storage for decision archives. Standard data engineering format, efficient for time-series. |
| **Pipeline Orchestration** | Prefect | Python-native workflow orchestration. Bulk contract ingestion, scheduled DBWD refresh, data quality checks. |
| **Event Streaming** | Redis Streams | Real-time decision events across thousands of contracts. Already have Redis — zero new infrastructure. |
| **Data Quality** | Great Expectations | Data validation as code. Schema checks, range validation, null checks on bulk ingestion. |
| **Contract/Payroll Storage** | PostgreSQL + SQLAlchemy 2.0 | Full CRUD for contracts, bulk payroll import, historical search across millions of records. |
| **Enterprise Connectors** | Connector framework (V4.1) | Extensible middleware for ERP/HR system integration. SFTP, API clients, direct DB connections. |
| **Analytics Dashboard** | Recharts + React | Time-series charts in existing frontend. Decision volume, approval rates, cost trends, RAG quality over time. |
| **Multi-LLM Routing** | Mastra multi-provider + custom router | Model-agnostic LLM layer: OpenAI, Anthropic, Ollama. Cost/quality-based routing with fallback chains. |

---

## Data Flows

### 1. Scheduled Ingest Pipeline (Prefect)

```
Daily 06:00 (Prefect schedule)
         │
         ▼
┌──────────────────────┐
│  fetch_sam_gov_rates │  Task: fetch DBWD rates for all localities
│  (retries=3)         │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  validate_rates      │  Task: Great Expectations suite
│                      │  - No nulls in rate columns
│                      │  - Rates within historical range ±20%
│                      │  - All trade codes valid
└──────────┬───────────┘
           │
      ┌────┴────┐
      ▼         ▼
  ┌──────┐  ┌────────┐
  │ PASS │  │ FAIL   │  → Alert + quarantine + human review
  │      │  │        │
  └──┬───┘  └────────┘
     │
     ▼
┌──────────────────────┐
│  load_rates          │  Task: UPSERT to PostgreSQL
│                      │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  export_to_parquet   │  Task: append to archive/decisions/YYYY-MM.parquet
└──────────────────────┘
```

### 2. Real-Time Decision Streaming (Redis Streams)

```
Python Backend (on decision persist)
         │
         ▼
┌────────────────────────────────┐
│  emit_decision_event()          │
│  XADD decisions:stream {        │
│    decision_id, status,       │
│    trust_score, trade,          │
│    timestamp, model_used        │
│  }                              │
└──────────────┬─────────────────┘
               │
               ▼
         Redis Streams
               │
      ┌────────┴────────┐
      ▼                 ▼
┌──────────┐      ┌──────────┐
│ Consumer │      │ Consumer │
│ Agent    │      │ Analytics│
│ Gateway  │      │ DuckDB   │
│ (SSE)    │      │ (rollup) │
└────┬─────┘      └──────────┘
     │
     ▼
┌─────────────────┐
│  SSE to React   │
│  Real-time      │
│  dashboard      │
│  updates        │
└─────────────────┘
```

### 3. Analytics Query Flow (DuckDB)

```
Analytics API Request
         │
         ▼
┌────────────────────────────────┐
│  DuckDB (in-process)            │
│                                 │
│  SELECT trade_code, locality,   │
│    COUNT(*) as decisions,       │
│    AVG(trust_score)             │
│  FROM postgres_scan('pg_conn',   │
│                   'decisions')  │
│  WHERE created_at > now() - 30d │
│  GROUP BY 1, 2                  │
│                                 │
│  UNION ALL (for archive):       │
│  FROM read_parquet(             │
│    'archive/2025-*.parquet'     │
│  )                              │
└──────────────┬─────────────────┘
               │
               ▼
┌────────────────────────────────┐
│  Return aggregated JSON         │
│  to React → Recharts            │
└────────────────────────────────┘
```

---

## Multi-LLM Routing (V3.1)

### Routing Logic

```typescript
// agent/src/lib/llm-router.ts
interface RoutingDecision {
  provider: 'openai' | 'anthropic' | 'ollama';
  model: string;
  reasoning: string;
}

function routeLLM(request: LLMRequest): RoutingDecision {
  // Priority 1: Explicit provider override
  if (request.preferredProvider) {
    return { provider: request.preferredProvider, ... };
  }
  
  // Priority 2: Cost mode (budget flag)
  if (request.costMode === 'minimal') {
    return { provider: 'ollama', model: 'llama3.2', reasoning: 'Zero-cost local model for non-critical path' };
  }
  
  // Priority 3: Compliance-critical path
  if (request.taskType === 'compliance_decision' && request.trustBand === 'low') {
    return { provider: 'openai', model: 'gpt-4o', reasoning: 'Highest accuracy for contested decisions' };
  }
  
  // Priority 4: Synthesis/drafting
  if (request.taskType === 'synthesis' || request.taskType === 'drafting') {
    return { provider: 'anthropic', model: 'claude-3-sonnet', reasoning: 'Cost/quality balance for text generation' };
  }
  
  // Default: balanced
  return { provider: 'openai', model: 'gpt-4o-mini', reasoning: 'Default cost/quality balance' };
}

// Fallback chain: if provider fails, try next
const fallbackChain = ['openai', 'anthropic', 'ollama'];
```

### Provider Configuration

```typescript
// agent/src/mastra/config/providers.ts
export const providers = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    defaultModel: 'gpt-4o',
    costPer1KTokens: { input: 0.0025, output: 0.01 },
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    defaultModel: 'claude-3-sonnet-20240229',
    costPer1KTokens: { input: 0.003, output: 0.015 },
  },
  ollama: {
    baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
    defaultModel: 'llama3.2',
    costPer1KTokens: { input: 0, output: 0 }, // Local = free
  },
};
```

---

## Directory Structure Additions

```
backend/src/
├── analytics/                    # NEW: DuckDB OLAP queries
│   ├── __init__.py
│   ├── queries.py               # SQL queries for dashboard
│   ├── duckdb_store.py          # DuckDB connection, PG scan
│   └── api.py                   # FastAPI endpoints: /analytics/*
│
├── pipelines/                   # NEW: Prefect ETL flows
│   ├── __init__.py
│   ├── dbwd_refresh.py          # Scheduled DBWD rate refresh
│   ├── decision_export.py       # Parquet export job
│   └── utils.py                 # Prefect task helpers
│
├── events/                      # NEW: Redis Streams
│   ├── __init__.py
│   ├── producer.py              # emit_decision_event()
│   └── schemas.py               # DecisionEvent Pydantic model
│
├── quality/                     # NEW: Great Expectations
│   ├── __init__.py
│   ├── dbwd_expectations.py     # Validation suite for DBWD
│   └── common_expectations.py   # Reusable expectations
│
├── storage/                     # NEW: Parquet, DuckDB
│   ├── __init__.py
│   ├── parquet_writer.py        # Write decisions to Parquet
│   └── duckdb_init.py           # Initialize DuckDB views
│
├── pipeline/                    # EXISTING: extraction, validation
├── retrieval/                   # EXISTING: hybrid RAG
└── services/                    # EXISTING: DB, cache, Celery

agent/src/
├── lib/
│   ├── llm-router.ts            # NEW: Multi-LLM routing logic
│   └── provider-config.ts       # NEW: Provider configurations
│
├── mastra/
│   └── agents/
│       └── wcp-verdict.ts       # MODIFIED: use llm-router
│
└── events/                      # NEW: Redis Streams consumer
    ├── consumer.ts              # XREADGROUP for decisions:stream
    └── sse.ts                   # SSE push to frontend

frontend/src/
├── pages/
│   └── analytics/               # NEW: Analytics dashboard pages
│       ├── index.tsx            # /analytics - overview
│       ├── compliance.tsx       # /analytics/compliance
│       ├── wages.tsx            # /analytics/wages
│       └── llm.tsx              # /analytics/llm
│
└── components/
    └── analytics/               # NEW: Recharts components
        ├── DecisionVolumeChart.tsx
        ├── ApprovalRateChart.tsx
        ├── WageTrendChart.tsx
        └── LLMCostChart.tsx

data/                          # NEW: Data artifacts (git-ignored)
├── archive/
│   └── decisions/
│       ├── 2025-01.parquet
│       ├── 2025-02.parquet
│       └── ...
└── duckdb/
    └── wcp_analytics.duckdb   # Local DuckDB file
```

---

## Why These Technologies (Not Alternatives)

| Choice | Alternative | Why This |
|---|---|---|
| **DuckDB** | Snowflake, BigQuery, Redshift | In-process, no server, reads PG directly. Perfect for single-developer project scale. Shows modern OLAP thinking without cloud vendor lock-in. |
| **Prefect** | Airflow, Dagster | Python-native, lighter, better UX. Airflow is overkill for single-person workflows. Dagster adds complexity without benefit at this scale. |
| **Redis Streams** | Kafka, RabbitMQ | Already have Redis. Kafka for 100 decisions/day is architectural overkill. Streams provides the same patterns (consumer groups, persistence) at the right scale. |
| **Great Expectations** | Manual validation, custom checks | Standard for data quality as code. Shows professional data engineering practice. |
| **Parquet** | CSV, JSON | Columnar format standard for analytics. DuckDB reads Parquet natively. Efficient compression. |
| **Recharts** | Grafana, D3, Chart.js | React-native, fits existing stack. Grafana is infra monitoring, not product analytics. D3 is too low-level for dashboard needs. |

---

## Analytics Dashboard Pages

### /analytics (Overview)
- **Decision Volume**: Line chart (daily decisions, 30/90/365 day views)
- **Average Trust Score**: Trend line over time
- **Approval Rate**: Gauge or donut chart (approved / flagged / rejected)
- **Top Violations**: Bar chart (wage, overtime, fringe, signature)

### /analytics/compliance
- **Approval Rate by Trade**: Grouped bar chart (all 20 trades)
- **Approval Rate by Locality**: Heatmap (regions × approval %)
- **Violation Severity Distribution**: Stacked area chart

### /analytics/wages
- **Wage Violation Trend**: Line chart (violation count over time)
- **Actual vs. Required Wage**: Scatter plot (x: required, y: actual, outliers highlighted)
- **Fringe Benefit Compliance**: Line chart (compliant % over time)

### /analytics/llm
- **Cost Per Decision**: Line chart (cost in USD, 7/30/90 day trends)
- **Token Usage**: Stacked area chart (input vs output tokens)
- **Model Distribution**: Pie chart (GPT-4o vs Claude vs Ollama %)
- **Latency by Model**: Box plot (P50, P95, P99 per provider)

---

## Implementation Phases

### Phase 0: Readiness + Additive Scaffold
1. Verify all V3 tests, typechecks, lint checks, and builds still pass
2. Reconcile V3/V4 boundary, route prefix, and ownership documentation
3. Add import-safe V4 scaffold modules without changing V3 runtime behavior
4. Confirm CI remains green before implementing feature logic

### Phase 1: Analytics Foundation
1. Add DuckDB dependency + postgres_scan extension
2. Create analytics/ module with queries.py
3. Add /analytics/* API endpoints
4. Create Recharts dashboard components
5. Add /analytics/* routes in React

### Phase 2: Data Pipelines
1. Add Prefect dependency
2. Create dbwd_refresh.py flow
3. Add Great Expectations, define expectations
4. Test scheduled runs locally

### Phase 3: Streaming
1. Add Redis Streams producer (decision events)
2. Add consumer in Agent Gateway
3. Implement SSE push to React
4. Add real-time updates to dashboard

### Phase 4: Parquet Archive
1. Add decision_export.py pipeline
2. Schedule weekly Parquet export
3. Update DuckDB queries to read from Parquet
4. Implement time-series aggregations

### Phase 5: Enterprise Connectors
1. Add connector base abstractions
2. Implement SFTP/API/database connector stubs
3. Add connector sync orchestration
4. Validate connector configs without exposing secrets

### Phase 6: Contract/Payroll CRUD
1. Add migration 006 for V4-owned tables and optional `decisions.contract_id`
2. Create contracts/payrolls/ingestion modules and `/v4/*` backend routers
3. Add agent `/api/*` proxy routes
4. Add frontend `/contracts`, `/payrolls`, and `/ingestion` pages

---

## V4 Success Criteria: Data Platform Metrics

### Scale Targets (vs V3 Baseline)

| Capability | V3 | V4 Target | Multiplier |
|---|---|---|---|
| **Concurrent contracts** | 1-10 active | 1,000+ active | 100× |
| **Payroll records** | Thousands | Millions | 1000× |
| **Historical depth** | Current batch | 10 years | Infinite (time-based) |
| **Bulk ingestion** | 100 WCPs/batch | 10,000 WCPs/batch | 100× |
| **Analytics query time** | N/A (no OLAP) | < 5s for cross-contract aggregates | New capability |

### Data Platform Quality Targets

| Metric | Target | Measurement | Data Engineering Standard |
|---|---|---|---|
| **Data freshness** | < 1 hour from source to query | Prefect pipeline monitoring | Near-real-time for compliance |
| **Data quality pass rate** | > 99% of batches pass GE validation | Great Expectations reports | Failed batches quarantined automatically |
| **Schema drift detection** | < 1 hour detection time | Prefect + GE alerting | Source schema changes caught fast |
| **Parquet archive integrity** | 100% MD5 verification on write | Custom validation task | Archive corruption prevention |

### Analytics Dashboard KPIs

| KPI | Definition | Target | Business Question Answered |
|---|---|---|---|
| **Decision volume trend** | WCPs processed per week | Baseline ± 20% | Is workload growing? |
| **Approval rate by trade** | % approved per trade code | 70-90% range | Which trades have more violations? |
| **Wage violation rate** | % decisions with wage findings | < 15% | Are contractors compliant overall? |
| **Average trust score** | Mean trust_score across all decisions | > 0.75 | Is the AI confident in its decisions? |
| **Cost per decision trend** | $/decision over time | Decreasing (efficiency gains) | Are we getting more efficient? |
| **Human review queue depth** | # decisions awaiting review | < 50 at all times | Is human capacity sufficient? |
| **RAG retrieval precision@5** | % of top 5 results that are relevant | > 90% | Is the search finding the right rates? |
| **Cross-contract violation patterns** | Geographic/temporal clusters | Detectable via dashboard | Are violations localized or systemic? |

### Real-Time Streaming Targets

| Metric | Target | Measurement | Use Case |
|---|---|---|---|
| **Event latency** | < 500ms from decision → dashboard | Redis Streams monitoring | Live operations center view |
| **Stream throughput** | 100 events/second | Redis XLEN monitoring | Peak load handling |
| **Consumer lag** | < 5 seconds | Consumer group monitoring | Real-time without loss |

---

## Related

- [V3_PLAN.md](V3_PLAN.md) — Core AI architecture
- [V2_TO_V3_TRANSITION.md](V2_TO_V3_TRANSITION.md) — Evolution from POC to production
- [architecture.md](docs/architecture.md) — System design documentation

---

*Generated: 2026-04-22*
