# V4 Architecture: Enterprise Data Platform

**Extending V3 from individual document processing to full-scale contract/payroll database platform.**

---

## Overview

V4 is an **additive data platform layer** built on top of V3's production-ready AI decision system. All V3 services, endpoints, and workflows remain unchanged and operational. V4 adds new modules, new data flows, and new scale capabilities to the same three-service architecture.

**V3** handles multi-document uploads (batches of 10-100 WCPs) with async Celery processing. Suitable for contractor-level workloads: weekly payroll batches, monthly reporting, demo-scale databases with thousands of records.

**V4** adds enterprise-scale capabilities:
- **Scale jump:** From thousands to millions of payroll records (PostgreSQL partitioning)
- **Persistence:** Contract/payroll tables with full CRUD (vs. transient job results in V3)
- **Historical depth:** Multi-year payroll database with full search (vs. current batch only)
- **Enterprise integration:** Middleware connectors to ERP/HR systems (SFTP, APIs, direct DB)
- **Analytics:** Cross-contract OLAP with DuckDB (reading from the same PostgreSQL)
- **Data quality:** Great Expectations validation on every ingestion pipeline
- **Event streaming:** Redis Streams for real-time decision events across all contracts
- **New management pages:** `/contracts`, `/payrolls`, `/ingestion`, `/analytics/*` alongside existing `/analyze`

---

## System Architecture (V3 + V4)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  REACT 19 FRONTEND                                                          │
│                                                                             │
│  V3 pages (unchanged):                                                      │
│  ├── /analyze     — WCP upload + analysis                                   │
│  ├── /decisions   — Searchable decision history                             │
│  ├── /review      — Human review queue (trust < 0.60)                       │
│  └── /settings    — Prompt version selector, model picker                   │
│                                                                             │
│  V4 pages (additive):                                                       │
│  ├── /contracts           — Bulk contract management (upload 1000s)         │
│  ├── /payrolls            — Payroll database browser & search               │
│  ├── /ingestion           — ETL job monitoring and data source management   │
│  └── /analytics/*         — Cross-contract analytics dashboard (Recharts)   │
│      ├── /analytics              — Overview                                 │
│      ├── /analytics/compliance   — Compliance analytics                     │
│      ├── /analytics/wages        — Wage analytics                           │
│      └── /analytics/llm          — LLM cost and performance analytics       │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ HTTP / REST + SSE
                                    │
┌───────────────────────────────────▼─────────────────────────────────────────┐
│  AGENT GATEWAY (TypeScript / Hono / Mastra.ai)                              │
│                                                                             │
│  V3 routes (unchanged):                                                     │
│  ├── POST /api/analyze          — Single WCP text analysis                  │
│  ├── POST /api/analyze-pdf      — PDF upload (single + batch)              │
│  ├── POST /api/analyze-csv      — CSV bulk upload                           │
│  ├── GET  /api/decisions        — List decisions                            │
│  ├── GET  /api/decisions/:id    — Single decision                           │
│  ├── GET  /api/decisions/stream — SSE decision events                       │
│  ├── POST /api/jobs             — Submit async job                          │
│  ├── GET  /api/jobs/:id         — Job status                                │
│  └── POST /api/auth/login       — JWT authentication                        │
│                                                                             │
│  V4 routes (additive):                                                      │
│  ├── GET/POST /api/contracts          — Contract CRUD                       │
│  ├── POST     /api/bulk-upload        — Enterprise CSV/PDF ingestion        │
│  ├── GET/POST /api/payrolls           — Payroll record management           │
│  ├── GET      /api/ingestion/status   — Prefect ETL job monitoring          │
│  ├── GET      /api/analytics/*        — DuckDB analytics proxy              │
│  └── GET      /api/events/subscribe   — V4 Redis Streams SSE                │
│                                                                             │
│  V4 event consumer (new):                                                   │
│  └── Redis Streams XREADGROUP → SSE push to frontend                        │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ REST (service-to-service)
                                    │
┌───────────────────────────────────▼─────────────────────────────────────────┐
│  PYTHON BACKEND (FastAPI)                                                    │
│                                                                             │
│  V3 core modules (unchanged):                                               │
│  ├── pipeline/          Deterministic extraction, validation, rules          │
│  ├── retrieval/         Hybrid RAG — BM25 + vector + rerank                 │
│  └── services/          DB (PostgreSQL), cache (Redis), Celery tasks        │
│                                                                             │
│  V4 new modules (additive):                                                 │
│  ├── contracts/         Contract database management (CRUD + bulk import)   │
│  ├── payrolls/          Payroll record storage, historical search            │
│  ├── ingestion/         Bulk document processors, batch pipelines           │
│  ├── connectors/        ERP/HR system connectors (extensibility framework)  │
│  ├── analytics/         DuckDB OLAP queries → API endpoints                 │
│  ├── pipelines/         Prefect ETL flows (DBWD refresh + bulk processing)  │
│  ├── events/            Redis Streams producer (decision events)             │
│  ├── quality/           Great Expectations validation suites                │
│  └── storage/           Parquet export, DuckDB integration                  │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
           ┌────────────────────────┼──────────────────────────┐
           │                        │                          │
           ▼                        ▼                          ▼
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────────────┐
│  PostgreSQL 16   │   │  Redis 7         │   │  DATA PLATFORM LAYER     │
│  + pgvector      │   │  + Streams       │   │                          │
│                  │   │                  │   │ ┌──────────────────────┐ │
│  V3 (unchanged): │   │  V3 (unchanged): │   │ │ DuckDB (in-process)  │ │
│  - decisions     │   │  - Celery broker │   │ │ OLAP analytics       │ │
│  - audit_events  │   │  - DBWD cache    │   │ │ Reads PG + Parquet   │ │
│  - dbwd_rates    │   │                  │   │ └──────────────────────┘ │
│  - jobs          │   │  V4 (additive):  │   │ ┌──────────────────────┐ │
│  - users         │   │  - decisions:    │   │ │ Apache Parquet       │ │
│                  │   │    stream        │   │ │ Archive storage      │ │
│  V4 (additive):  │   │  - ingestion     │   │ └──────────────────────┘ │
│  - contracts     │   │    events        │   └──────────────────────────┘
│  - payrolls      │   │                  │
│    (partitioned) │   │                  │
│  - ingestion_    │   │                  │
│    jobs          │   │                  │
│  - connector_    │   │                  │
│    configs       │   │                  │
└──────────────────┘   └──────────────────┘
           │
           ▼
┌──────────────────┐   ┌──────────────────────────┐
│ EXTERNAL SOURCES │   │  Connector Framework     │
│ (V4 Middleware)  │   │  (Extensible)            │
├──────────────────┤   │                          │
│ - SFTP drops     │◄──│  BaseConnector ABC       │
│ - Contract Mgmt  │   │  ├── SFTPConnector       │
│ - ERP/HR APIs    │   │  ├── APIConnector         │
│ - Direct DB conn │   │  └── DatabaseConnector    │
│ - File shares    │   └──────────────────────────┘
└──────────────────┘
```

---

## Module Responsibilities

### V4 Backend Modules

#### `contracts/` — Contract Database Management

**Purpose:** Full CRUD for federal construction contracts. Each contract represents a covered project with a prime contractor, project details, and a date range. Contracts are the top-level organizational unit for V4 — payroll records and decisions are linked to contracts.

**Responsibilities:**
- Contract creation, update, deletion, listing (paginated)
- Bulk import from CSV/JSON (thousands at a time)
- Contract status tracking (active, completed, terminated)
- Reference integrity: decisions and payroll records link to contracts via `contract_id`

**Key files:**
- `contracts/router.py` — FastAPI endpoints (`/contracts/*`)
- `contracts/models.py` — SQLAlchemy 2.0 models for `contracts` table
- `contracts/service.py` — Business logic, bulk import, validation
- `contracts/schemas.py` — Pydantic v2 request/response schemas

#### `payrolls/` — Payroll Record Storage

**Purpose:** Persistent storage for individual payroll records extracted from WCP submissions. Millions of rows, partitioned by `contract_id` and date for query performance. Supports historical search across contracts.

**Responsibilities:**
- Payroll record CRUD and bulk import
- Historical search: by contract, employee, trade, date range, locality
- Partition management: automatic partition creation per contract
- Link payroll records to V3 analysis decisions via `decision_id`

**Key files:**
- `payrolls/router.py` — FastAPI endpoints (`/payrolls/*`)
- `payrolls/models.py` — SQLAlchemy 2.0 models for `payroll_records` table (partitioned)
- `payrolls/service.py` — Search, bulk import, partition management
- `payrolls/schemas.py` — Pydantic v2 request/response schemas

#### `ingestion/` — Bulk Document Processing

**Purpose:** Orchestrate bulk ingestion of contracts and payroll records from various sources (CSV, PDF, API). Coordinates with V3's existing Celery infrastructure for async processing.

**Responsibilities:**
- Accept bulk upload requests (CSV/PDF with thousands of records)
- Validate input format before processing
- Enqueue processing tasks (Celery or Prefect depending on scale)
- Track ingestion job status and progress
- Report per-record errors without failing the entire batch

**Key files:**
- `ingestion/router.py` — FastAPI endpoints (`/ingestion/*`)
- `ingestion/processor.py` — Bulk record extraction and validation
- `ingestion/tasks.py` — Celery/Prefect task definitions
- `ingestion/schemas.py` — Ingestion job schemas

#### `connectors/` — Enterprise System Integration

**Purpose:** Extensible middleware framework for connecting to external enterprise systems (ERP, HR platforms, SFTP drops, direct database connections). V4.1 scope — framework is designed but specific connectors are added incrementally.

**Responsibilities:**
- Abstract base class for all connectors
- Connection configuration storage and validation
- Scheduled sync via Prefect (pull from external sources)
- Error handling and retry logic per connector type

**Key files:**
- `connectors/base.py` — `BaseConnector` ABC with `connect()`, `fetch()`, `validate()`
- `connectors/sftp.py` — SFTP connector for CSV/PDF drops
- `connectors/api_client.py` — Generic REST API connector
- `connectors/database.py` — Direct database connector (read replicas)
- `connectors/registry.py` — Connector discovery and configuration

#### `analytics/` — DuckDB OLAP Engine

**Purpose:** Fast analytical queries across millions of decisions and payroll records using DuckDB's in-process OLAP engine. Reads directly from PostgreSQL (operational data) and Parquet files (historical archive) without data duplication.

**Responsibilities:**
- DuckDB connection management and view registration
- Analytical SQL queries for dashboard endpoints
- Cross-contract aggregation (decision volume, approval rates, wage trends)
- Time-series analysis (daily/weekly/monthly aggregations)
- LLM cost and performance analytics

**Key files:**
- `analytics/router.py` — FastAPI endpoints (`/analytics/*`)
- `analytics/queries.py` — SQL query functions for each dashboard widget
- `analytics/duckdb_store.py` — DuckDB connection, PostgreSQL scan, Parquet read
- `analytics/schemas.py` — Response schemas for analytics endpoints

#### `pipelines/` — Prefect ETL Orchestration

**Purpose:** Scheduled and on-demand ETL pipelines using Prefect. Orchestrates data refresh, bulk processing, and data quality validation workflows.

**Responsibilities:**
- `dbwd_refresh` flow: Scheduled SAM.gov rate refresh with GE validation
- `decision_export` flow: Weekly Parquet archive export
- `bulk_ingest` flow: Orchestrates large-scale contract/payroll ingestion
- Flow monitoring, retry logic, and failure alerting

**Key files:**
- `pipelines/dbwd_refresh.py` — Scheduled DBWD rate refresh flow
- `pipelines/decision_export.py` — Parquet export job
- `pipelines/bulk_ingest.py` — Bulk ingestion orchestration
- `pipelines/utils.py` — Prefect task helpers and shared utilities

#### `events/` — Redis Streams Producer

**Purpose:** Emit real-time decision events to Redis Streams whenever a decision is persisted. Enables live dashboard updates and cross-service event consumption.

**Responsibilities:**
- `emit_decision_event()` — XADD to `decisions:stream` on decision persist
- Event schema definition (DecisionEvent Pydantic model)
- Consumer group management for downstream consumers

**Key files:**
- `events/producer.py` — `emit_decision_event()` function
- `events/schemas.py` — DecisionEvent Pydantic model

#### `quality/` — Great Expectations Validation

**Purpose:** Data quality validation as code. Every ingestion pipeline runs through GE suites before data reaches the database. Failed batches are quarantined for human review.

**Responsibilities:**
- DBWD rate validation: no nulls, rates within ±20% of historical range, valid trade codes
- Contract data validation: required fields, date range consistency
- Payroll record validation: wage ranges, hours limits, trade code validity
- Validation reporting and quarantine management

**Key files:**
- `quality/dbwd_expectations.py` — DBWD validation suite
- `quality/contract_expectations.py` — Contract validation suite
- `quality/payroll_expectations.py` — Payroll validation suite
- `quality/common_expectations.py` — Reusable expectation definitions

#### `storage/` — Parquet Archive & DuckDB Integration

**Purpose:** Write decision data to Apache Parquet columnar files for long-term analytical storage. DuckDB reads both live PostgreSQL and Parquet archives transparently.

**Responsibilities:**
- Write decisions to monthly Parquet files (`archive/decisions/YYYY-MM.parquet`)
- Register Parquet files as DuckDB external tables
- MD5 integrity verification on write
- Partition pruning for date-range queries

**Key files:**
- `storage/parquet_writer.py` — Write decisions to Parquet with PyArrow
- `storage/duckdb_init.py` — Initialize DuckDB views (PostgreSQL + Parquet)

---

## OLTP vs OLAP Separation

V4 maintains a clear boundary between operational (OLTP) and analytical (OLAP) workloads:

| Aspect | OLTP (PostgreSQL) | OLAP (DuckDB) |
|---|---|---|
| **Purpose** | Transactional: CRUD, real-time lookups | Analytical: aggregations, trends |
| **Data** | Current operational data | Historical + current (reads PG + Parquet) |
| **Query pattern** | Point lookups, small writes | Full scans, GROUP BY, time-series |
| **Latency** | < 50ms per query | < 5s for cross-contract aggregates |
| **Storage** | Row-based (PostgreSQL heap) | Columnar (DuckDB in-memory + Parquet) |
| **Scale** | Millions of rows (partitioned) | Millions of rows (read-optimized) |
| **Writes** | V3 + V4 services write here | Read-only (no writes from DuckDB) |
| **Schema** | `public.*` (V3), `public.*` (V4 tables) | External tables over PG + Parquet |

**Key principle:** DuckDB never writes to PostgreSQL. It reads PostgreSQL via `postgres_scan()` and Parquet files via `read_parquet()`. This means analytical queries never impact operational write performance.

---

## How V4 Plugs Into V3

### Unchanged V3 Code

| V3 Component | V4 Impact |
|---|---|
| `backend/src/wcp_backend/pipeline/` | None — extraction and validation unchanged |
| `backend/src/wcp_backend/retrieval/` | None — hybrid RAG unchanged |
| `backend/src/wcp_backend/services/` | None — DB, Redis, Celery unchanged |
| `agent/src/mastra/` | None — Mastra agents and tools unchanged |
| `agent/src/api/analyze*` | None — analysis routes unchanged |
| `frontend/src/pages/Analyze.tsx` | None — upload flow unchanged |
| `frontend/src/pages/Decisions.tsx` | None — decision history unchanged |

### Integration Points

V4 integrates with V3 through **four clean interfaces**:

1. **Database reads:** V4's DuckDB reads V3's `decisions` and `audit_events` tables directly (read-only). V4 adds a `contract_id` foreign key column to `decisions` via migration — no V3 code changes needed.

2. **Event emission:** V4's `events/producer.py` emits events after V3's `services/audit.py` persists a decision. This is a post-commit hook — no change to V3's persistence logic.

3. **API proxy:** V4's agent routes are separate Hono routers mounted alongside V3's existing routes. No V3 route files are modified.

4. **Redis Streams:** V4 uses the same Redis instance V3 already uses (for Celery broker and DBWD cache). V4 adds a new stream key `decisions:stream` — zero impact on existing Redis usage.

### V3/V4 Database Ownership

| Table | Owner | V3 Access | V4 Access |
|---|---|---|---|
| `decisions` | V3 | Read/Write | Read-only (+ contract_id FK) |
| `audit_events` | V3 | Read/Write | Read-only |
| `dbwd_rates` | V3 | Read/Write | Read-only |
| `jobs` | V3 | Read/Write | Read-only |
| `users` | V3 | Read/Write | None |
| `regulation_chunks` | V3 | Read/Write | Read-only |
| `contracts` | **V4** | None | Read/Write |
| `payroll_records` | **V4** | None | Read/Write |
| `ingestion_jobs` | **V4** | None | Read/Write |
| `connector_configs` | **V4** | None | Read/Write |

---

## V4 Agent Gateway Extensions

### New Routes (Separate Router)

V4 agent routes are defined in a separate router file and mounted on the existing Hono app:

```typescript
// agent/src/api/v4-contracts.ts    — /api/contracts/*
// agent/src/api/v4-payrolls.ts     — /api/payrolls/*
// agent/src/api/v4-ingestion.ts    — /api/ingestion/*
// agent/src/api/v4-analytics.ts    — /api/analytics/* (proxy to backend)
```

### Event Consumer

V4 adds a Redis Streams consumer to the agent:

```typescript
// agent/src/events/consumer.ts     — XREADGROUP for decisions:stream
// agent/src/events/sse.ts          — SSE push to frontend analytics pages
```

The consumer runs as a background process alongside the existing Hono server. It reads from the `decisions:stream` consumer group and pushes events to connected SSE clients.

---

## Directory Structure

```
backend/src/
├── analytics/                    # V4: DuckDB OLAP queries
│   ├── __init__.py
│   ├── router.py                 # FastAPI endpoints: /analytics/*
│   ├── queries.py                # SQL queries for dashboard widgets
│   ├── duckdb_store.py           # DuckDB connection, PG scan, Parquet read
│   └── schemas.py                # Analytics response schemas
│
├── pipelines/                    # V4: Prefect ETL flows
│   ├── __init__.py
│   ├── dbwd_refresh.py           # Scheduled DBWD rate refresh
│   ├── decision_export.py        # Parquet export job
│   ├── bulk_ingest.py            # Bulk contract/payroll ingestion
│   └── utils.py                  # Prefect task helpers
│
├── events/                       # V4: Redis Streams
│   ├── __init__.py
│   ├── producer.py               # emit_decision_event()
│   └── schemas.py                # DecisionEvent Pydantic model
│
├── quality/                      # V4: Great Expectations
│   ├── __init__.py
│   ├── dbwd_expectations.py      # DBWD validation suite
│   ├── contract_expectations.py  # Contract validation suite
│   ├── payroll_expectations.py   # Payroll validation suite
│   └── common_expectations.py    # Reusable expectations
│
├── storage/                      # V4: Parquet, DuckDB
│   ├── __init__.py
│   ├── parquet_writer.py         # Write decisions to Parquet
│   └── duckdb_init.py            # Initialize DuckDB views
│
├── contracts/                    # V4: Contract management
│   ├── __init__.py
│   ├── router.py                 # FastAPI: /contracts/*
│   ├── models.py                 # SQLAlchemy 2.0 models
│   ├── service.py                # Business logic, bulk import
│   └── schemas.py                # Pydantic request/response
│
├── payrolls/                     # V4: Payroll record storage
│   ├── __init__.py
│   ├── router.py                 # FastAPI: /payrolls/*
│   ├── models.py                 # SQLAlchemy 2.0 models (partitioned)
│   ├── service.py                # Search, bulk import, partitions
│   └── schemas.py                # Pydantic request/response
│
├── ingestion/                    # V4: Bulk document processing
│   ├── __init__.py
│   ├── router.py                 # FastAPI: /ingestion/*
│   ├── processor.py              # Bulk extraction and validation
│   ├── tasks.py                  # Celery/Prefect task definitions
│   └── schemas.py                # Ingestion job schemas
│
├── connectors/                   # V4: Enterprise connectors
│   ├── __init__.py
│   ├── base.py                   # BaseConnector ABC
│   ├── sftp.py                   # SFTP connector
│   ├── api_client.py             # REST API connector
│   ├── database.py               # Direct DB connector
│   └── registry.py               # Connector discovery
│
├── pipeline/                     # V3: extraction, validation (unchanged)
├── retrieval/                    # V3: hybrid RAG (unchanged)
└── services/                     # V3: DB, cache, Celery (unchanged)

agent/src/
├── api/
│   ├── analyze.ts                # V3 (unchanged)
│   ├── analyze-pdf.ts            # V3 (unchanged)
│   ├── analyze-csv.ts            # V3 (unchanged)
│   ├── decisions.ts              # V3 (unchanged)
│   ├── jobs.ts                   # V3 (unchanged)
│   ├── auth.ts                   # V3 (unchanged)
│   ├── analytics.ts              # V3 (unchanged)
│   ├── v4-contracts.ts           # V4: /api/contracts/*
│   ├── v4-payrolls.ts            # V4: /api/payrolls/*
│   ├── v4-ingestion.ts           # V4: /api/ingestion/*
│   └── v4-analytics.ts           # V4: /api/analytics/* (proxy)
│
├── events/                       # V4: Redis Streams consumer
│   ├── consumer.ts               # XREADGROUP for decisions:stream
│   └── sse.ts                    # SSE push to frontend
│
├── mastra/                       # V3 (unchanged)
└── lib/                          # V3.1 (unchanged)

frontend/src/
├── pages/
│   ├── Analyze.tsx               # V3 (unchanged)
│   ├── Decisions.tsx             # V3 (unchanged)
│   ├── Dashboard.tsx             # V3 (unchanged)
│   ├── Analytics.tsx             # V3 (unchanged)
│   ├── Login.tsx                 # V3 (unchanged)
│   └── analytics/                # V4: Analytics dashboard
│       ├── index.tsx             # /analytics — overview
│       ├── compliance.tsx        # /analytics/compliance
│       ├── wages.tsx             # /analytics/wages
│       └── llm.tsx               # /analytics/llm
│
├── components/
│   └── analytics/                # V4: Recharts components
│       ├── DecisionVolumeChart.tsx
│       ├── ApprovalRateChart.tsx
│       ├── WageTrendChart.tsx
│       ├── LLMCostChart.tsx
│       └── AnalyticsLayout.tsx
│
└── pages/
    ├── Contracts.tsx             # V4: Contract management
    ├── Payrolls.tsx              # V4: Payroll browser
    └── Ingestion.tsx             # V4: ETL job monitoring

data/                              # V4: Data artifacts (git-ignored)
├── archive/
│   └── decisions/
│       ├── 2025-01.parquet
│       ├── 2025-02.parquet
│       └── ...
└── duckdb/
    └── wcp_analytics.duckdb      # Local DuckDB file
```

---

## V4 Tech Stack

| Layer | Technology | Architectural Purpose |
|---|---|---|
| **Database Scale** | PostgreSQL 16 + partitioning | Millions of payroll records, partitioned by contract_id + date for query performance |
| **Analytics Engine** | DuckDB | In-process OLAP: 10-100x faster than PostgreSQL for analytical queries. Reads live PostgreSQL + Parquet. No extra server |
| **Data Format** | Apache Parquet | Columnar storage for decision archives. Standard data engineering format, efficient for time-series |
| **Pipeline Orchestration** | Prefect | Python-native workflow orchestration. Bulk contract ingestion, scheduled DBWD refresh, data quality checks |
| **Event Streaming** | Redis Streams | Real-time decision events across thousands of contracts. Already have Redis — zero new infrastructure |
| **Data Quality** | Great Expectations | Data validation as code. Schema checks, range validation, null checks on bulk ingestion |
| **Contract/Payroll Storage** | PostgreSQL + SQLAlchemy 2.0 | Full CRUD for contracts, bulk payroll import, historical search across millions of records |
| **Enterprise Connectors** | Connector framework (V4.1) | Extensible middleware for ERP/HR system integration. SFTP, API clients, direct DB connections |
| **Analytics Dashboard** | Recharts + React | Time-series charts in existing frontend. Decision volume, approval rates, cost trends, RAG quality over time |
| **Multi-LLM Routing** | Mastra multi-provider + custom router | Model-agnostic LLM layer (V3.1). OpenAI, Anthropic, Ollama. Cost/quality-based routing with fallback chains |

---

## Why These Technologies (Not Alternatives)

| Choice | Alternative | Why This |
|---|---|---|
| **DuckDB** | Snowflake, BigQuery, Redshift | In-process, no server, reads PG directly. Shows modern OLAP thinking without cloud vendor lock-in |
| **Prefect** | Airflow, Dagster | Python-native, lighter, better UX. Airflow is overkill for single-person workflows |
| **Redis Streams** | Kafka, RabbitMQ | Already have Redis. Kafka for 100 decisions/day is architectural overkill. Streams provides the same patterns (consumer groups, persistence) at the right scale |
| **Great Expectations** | Manual validation, custom checks | Standard for data quality as code. Shows professional data engineering practice |
| **Parquet** | CSV, JSON | Columnar format standard for analytics. DuckDB reads Parquet natively. Efficient compression |
| **Recharts** | Grafana, D3, Chart.js | React-native, fits existing stack. Grafana is infra monitoring, not product analytics |
| **PostgreSQL Partitioning** | Separate time-series DB (TimescaleDB) | One database, one operational model. Partitioning handles millions of rows without new infrastructure |

---

## Related Documentation

- [V4 Data Model & Schema](v4-data-model.md) — Full DDL, partitioning, Parquet schema
- [V4 Data Flows](v4-data-flows.md) — Sequence diagrams for all 5 data flows
- [V4 API Contract](../v4-api-contract.md) — New endpoint specifications
- [V4 Analytics Dashboard](../v4-analytics-dashboard.md) — Wireframe-level component specs
- [V3/V4 Boundary](../planning/V3_V4_BOUNDARY.md) — Clean handoff specification
- [V4 Plan](../planning/V4_PLAN.md) — Original planning document
- [V3 Architecture](../architecture.md) — Core AI system architecture

---

*Generated: 2026-04-30*
