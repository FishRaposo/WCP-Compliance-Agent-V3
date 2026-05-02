# WCP Compliance Agent

[![CI](https://github.com/FishRaposo/WCP-Compliance-Agent-V3/actions/workflows/ci.yml/badge.svg)](https://github.com/FishRaposo/WCP-Compliance-Agent-V3/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.12+](https://img.shields.io/badge/Python-3.12+-3776AB?logo=python&logoColor=white)](https://python.org)
[![Node 20+](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)

**Three-service AI decision engine for Davis-Bacon Act payroll compliance.**

Automates WH-347 federal construction payroll review using a deterministic Python backend, a TypeScript LLM orchestration agent, and a React frontend. Every compliance decision includes regulation citations, trust scores, and a full audit trail — built for the kind of scrutiny that federal inspectors bring.

| Metric | Value |
|---|---|
| **Services** | 3 (Python backend + TypeScript agent + React frontend) |
| **Tests** | 250+ passing (89 backend + 48 agent + 13 frontend + 100 golden set eval) |
| **Pipeline** | Extract → Validate → LLM Verdict → Trust Score → Persist |
| **LLM Routing** | OpenAI + Anthropic + Ollama with automatic fallback |
| **Frontend** | 7 pages, 12 components, mock mode for standalone dev |
| **V4 Data Platform** | Contracts CRUD, payroll records, bulk CSV ingestion, DuckDB analytics, Prefect ETL, Redis Streams, GE-style validation, Parquet archive |
| **CI/CD** | GitHub Actions, scheduled eval, Vercel + Render deploy |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  REACT 19 FRONTEND                                                            │
│  Vite + Tailwind + Shadcn/ui + TanStack Query                                │
│  Port: 5173                                                                  │
└────────────────────────────┬─────────────────────────────────────────────────┘
                             │ HTTP / REST + SSE
┌────────────────────────────▼─────────────────────────────────────────────────┐
│  AGENT GATEWAY (TypeScript / Node)                                           │
│  Hono + Mastra.ai + Langfuse + Phoenix                                       │
│  Port: 3000                                                                  │
└──────────────┬───────────────────────────────────────────────────────────────┘
               │ REST
┌──────────────▼───────────────────────────────────────────────────────────────┐
│  PYTHON BACKEND (FastAPI)                                                     │
│  Deterministic pipeline + Hybrid RAG + Celery + Phoenix                      │
│  Port: 8000                                                                  │
└──────────────┬───────────────────────────────────────────────────────────────┘
               │
         ┌─────▼──────┐
         │  DATA      │
         │  PostgreSQL│
         │  Redis     │
         │  ES + PG   │
         └────────────┘
```

### V4 Data Platform Extension

V4 adds an enterprise data platform layer **on top of** the V3 AI decision engine — no V3 code modified:

| Component | Technology | Purpose |
|---|---|---|
| **Contract/Payroll DB** | PostgreSQL partitioned tables | Millions of records, full CRUD |
| **Analytics** | DuckDB in-process OLAP | Cross-contract aggregations, reads PostgreSQL + Parquet |
| **ETL Orchestration** | Prefect | Scheduled DBWD refresh, bulk ingestion, Parquet export |
| **Event Streaming** | Redis Streams | Real-time decision events (< 500ms latency) |
| **Data Quality** | Great Expectations | Validation on every ingestion pipeline |
| **Enterprise Connectors** | Extensible framework | SFTP, API, direct DB integration (V4.1) |

---

## Quick Start

### Try It Now (no infrastructure needed)

Mock mode runs the full UI and agent pipeline with fixture data — no database, no API keys:

```bash
git clone https://github.com/FishRaposo/WCP-Compliance-Agent-V3.git
cd WCP-Compliance-Agent-V3

# Frontend only (fixture data, no backend needed)
cd frontend && npm ci && VITE_MOCK_API=true npm run dev

# Agent with mock LLM (deterministic verdicts)
cd agent && npm ci && LLM_MODE=mock npm run dev
```

### Full Stack Setup

**Prerequisites:** Python 3.12+, Node.js 20+, PostgreSQL 16 (pgvector), Redis 7, Elasticsearch 8

```bash
# Install system dependencies, native infra, and service dependencies
bash scripts/setup-wsl-native.sh

# Check whether the machine is ready
bash scripts/check-install.sh
```

See [docs/install.md](docs/install.md) for the fresh-machine checklist, [docs/dependencies.md](docs/dependencies.md) for the full dependency inventory, and [docs/local-dev.md](docs/local-dev.md) for service-by-service commands.

### Services

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Agent API | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| Phoenix UI | http://localhost:6006 |

---

## Usage Flow

### V3 — Single Document Analysis

```bash
# 1. Upload a WH-347 PDF for compliance analysis
curl -X POST http://localhost:3000/api/analyze-pdf \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -F "file=@WH347-submission.pdf"

# Response includes: verdict, trust score, regulation citations, flag reasons
```

### V4 — Contract and Payroll Management

```bash
# 1. Create or import contracts
curl -X POST http://localhost:3000/api/contracts \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "contract_number": "GS-10P-2025-001",
    "project_name": "Federal Building HVAC Upgrade",
    "contractor_name": "Acme Mechanical Inc.",
    "locality": "Boston, MA",
    "start_date": "2025-01-15",
    "end_date": "2026-06-30"
  }'

# 2. Bulk import contracts from CSV
curl -X POST http://localhost:3000/api/contracts/bulk \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -F "file=@contracts_batch.csv"

# 3. Bulk import payroll records for a contract as JSON
curl -X POST http://localhost:3000/api/payrolls/bulk \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "contract_id": "abc-123",
    "source": "csv",
    "source_reference": "payroll_april.csv",
    "records": [{
      "employee_name": "John Smith",
      "trade_code": "ELEC",
      "locality_code": "Boston, MA",
      "week_ending": "2025-04-25",
      "total_hours": 40,
      "hourly_rate": 51.69,
      "gross_pay": 2067.60
    }]
  }'

# Or upload a CSV through the ingestion pipeline
curl -X POST http://localhost:3000/api/ingestion/bulk-upload \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -F "type=payroll_import" \
  -F "contract_id=abc-123" \
  -F "file=@payroll_april.csv"

# 4. Monitor ingestion job status
curl http://localhost:3000/api/ingestion/status/ingest-789 \
  -H "Authorization: Bearer $JWT_TOKEN"

# 5. Query cross-contract analytics (DuckDB)
curl "http://localhost:3000/api/analytics/overview" \
  -H "Authorization: Bearer $JWT_TOKEN"

# 6. Subscribe to real-time decision events (SSE)
curl -N http://localhost:3000/api/events/subscribe \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Accept: text/event-stream"
```

### CSV Format for Bulk Import

**Contracts CSV:**
```csv
contract_number,project_name,contractor_name,contractor_ein,agency,locality,start_date,end_date,total_value
GS-10P-2025-003,Park Restroom Renovation,BuildCo Inc.,11-1111111,NPS,Denver CO,2025-02-01,2025-08-31,320000
GS-10P-2025-004,Bridge Repair,SteelWorks LLC,22-2222222,DoT,Portland OR,2025-04-01,2026-03-31,1500000
```

**Payrolls CSV:**
```csv
employee_name,trade_code,week_ending,hours_worked,hourly_rate,gross_pay,overtime_hours,fringe_benefits
John Smith,ELEC,2025-04-25,40,51.69,2067.60,0,34.63
Jane Doe,PLUM,2025-04-25,44,48.50,2314.88,4,31.20
```

---

## Validation Commands

Run these before committing or deploying:

```bash
# Backend (cd backend)
poetry run ruff check .                    # Lint (F401, F821, etc.)
poetry run mypy src/                        # Strict typecheck
poetry run pytest tests/unit -v             # Unit tests (no infra)

# Agent (cd agent)
npm run typecheck                           # tsc --noEmit
npm run lint                                # eslint
npm run build                               # Production bundle
npm test                                    # vitest

# Frontend (cd frontend)
npm run typecheck                           # tsc -b
npm run lint                                # eslint
npm run build                               # Vite production build
npm test                                    # vitest + testing-library
```

**CI quality gates** (`.github/workflows/ci.yml`):
- Backend: `ruff check` + `pytest tests/unit` + integration tests
- Agent: `typecheck` + `lint` + `build` + `test`
- Frontend: `typecheck` + `build` + `test`

> **Note:** `mypy` is run as a local strict check only. CI does not include mypy due to CI runtime constraints. Run `poetry run mypy src/` locally before committing Python changes.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 19, Vite, Tailwind, Shadcn/ui, TanStack Query | Product UI |
| **Agent** | Hono, Mastra.ai, Vercel AI SDK, Langfuse, Phoenix | LLM orchestration |
| **Backend** | Python 3.12+, FastAPI, Pydantic v2, Celery, asyncpg | Deterministic logic, RAG |
| **Search** | Elasticsearch 8, pgvector, sentence-transformers | Hybrid retrieval |
| **V4 Analytics** | DuckDB | In-process OLAP, cross-contract queries |
| **V4 ETL** | Prefect | Workflow orchestration, scheduled jobs |
| **V4 Streaming** | Redis Streams | Real-time decision events |
| **V4 Quality** | Great Expectations | Data validation as code |
| **Observability** | Phoenix/Arize, Langfuse, OpenTelemetry | Tracing, prompt infra, cost |

---

## Project Structure

```
WCP-Compliance-Agent-V3/
├── backend/              # Python FastAPI + deterministic pipeline
│   ├── src/wcp_backend/
│   │   ├── pipeline/     # Extraction, validation, checks
│   │   ├── retrieval/    # Hybrid RAG (BM25 + vector + rerank)
│   │   ├── services/     # DB, Redis, Celery tasks
│   │   ├── analytics/    # V4: DuckDB OLAP queries
│   │   ├── contracts/    # V4: Contract CRUD + bulk import
│   │   ├── payrolls/     # V4: Payroll record storage
│   │   ├── ingestion/    # V4: Bulk document processing
│   │   ├── connectors/   # V4: Enterprise connector framework
│   │   ├── pipelines/    # V4: Prefect ETL flows
│   │   ├── events/       # V4: Redis Streams producer
│   │   ├── quality/      # V4: Great Expectations suites
│   │   └── storage/      # V4: Parquet archive + DuckDB
│   └── tests/
│       ├── eval/         # Golden set (100 examples) + regression
│       ├── integration/  # API endpoint + E2E pipeline tests
│       └── unit/         # Core logic tests (89 tests)
│
├── agent/                # TypeScript Mastra.ai agent
│   ├── src/
│   │   ├── api/          # Hono routes (V3: 9 files, V4: 6 files in v4/)
│   │   ├── mastra/       # Agents, tools, workflows
│   │   ├── lib/          # Multi-LLM router + provider config
│   │   ├── middleware/   # Auth, CORS, rate limiting
│   │   ├── langfuse/     # Tracing + cost tracking
│   │   ├── events/       # V4: Redis Streams consumer
│   │   └── prompts/      # Version registry + Langfuse
│   └── src/tests/        # 48 tests (unit + integration + router + V4)
│
├── frontend/             # React 19 SPA
│   └── src/
│       ├── components/   # 12 components + shadcn/ui primitives
│       ├── hooks/        # 6 TanStack Query hooks + SSE stream
│       ├── pages/        # 7 pages (V3: Analyze, Decisions, etc.; V4: contracts, payrolls, ingestion, analytics/*)
│       ├── types/        # Shared API types
│       └── utils/        # API client + mock data layer
│
├── shared/               # JSON Schema contracts
│   └── schemas/
│
└── docs/
    ├── adrs/            # Architecture Decision Records
    └── planning/        # V3/V4 Boundary, V4 phases
```

---

## V4 Feature Matrix

| Feature | Backend Module | Agent Route | Frontend Page | Status |
|---|---|---|---|---|
| **Contract CRUD** | [`contracts/`](backend/src/wcp_backend/contracts/) | `/api/contracts` | [`pages/contracts/`](frontend/src/pages/contracts/) | MVP |
| **Payroll Records** | [`payrolls/`](backend/src/wcp_backend/payrolls/) | `/api/payrolls` | [`pages/payrolls/`](frontend/src/pages/payrolls/) | MVP |
| **Bulk CSV Upload** | [`ingestion/`](backend/src/wcp_backend/ingestion/) | `/api/contracts/bulk`, `/api/payrolls/bulk` | [`pages/ingestion/`](frontend/src/pages/ingestion/) | MVP |
| **DuckDB Analytics** | [`analytics/`](backend/src/wcp_backend/analytics/) | `/api/analytics/*` | [`pages/analytics/`](frontend/src/pages/analytics/) | MVP |
| **Prefect ETL** | [`pipelines/`](backend/src/wcp_backend/pipelines/) | `/api/ingestion/status` | ETL job cards | MVP |
| **Redis Streams** | [`events/`](backend/src/wcp_backend/events/) | `/api/events/subscribe` | LiveFeed component | MVP |
| **GE Validation** | [`quality/`](backend/src/wcp_backend/quality/) | (integrated into ingestion) | Error reporting | MVP |
| **Connector Framework** | [`connectors/`](backend/src/wcp_backend/connectors/) | (V4.1 scope) | — | Framework |
| **Parquet Archive** | [`storage/`](backend/src/wcp_backend/storage/) | — | — | MVP |

### V4 Scale Targets

| Metric | V3 | V4 MVP |
|---|---|---|
| Concurrent contracts | 1–10 | 1,000+ |
| Payroll records | Thousands | Millions |
| Historical depth | Current batch | 10 years |
| Bulk ingestion | 100/batch | 10,000/batch |
| Analytics query | N/A | < 2s cross-contract |
| Event latency | N/A | < 500ms |

---

## Infrastructure-Dependent Limitations

V4 requires these services to be running:

| Dependency | Required For | Notes |
|---|---|---|
| **PostgreSQL 16 (pgvector)** | All V4 modules | Partitioning for payroll_records table |
| **Redis 7** | Events, ETL state | Streams consumer group requires Redis 7+ |
| **DuckDB** | Analytics queries | In-process OLAP; separate process optional |
| **Prefect** | ETL flows | Not required for basic CRUD operations |
| **Great Expectations** | Ingestion validation | Installed via `poetry install`; runs in-pipeline |
| **Elasticsearch 8** | V3 RAG only | Not required for V4 contract/payroll CRUD |

DuckDB, Prefect, PyArrow, and Great Expectations are declared backend dependencies. Contract/payroll CRUD can still be developed independently, but the full V4 portfolio demo expects `poetry install` to provide the complete data-platform runtime.

---

## Why This Architecture

**Federal compliance is safety-critical infrastructure.**

Davis-Bacon Act violations carry penalties of back wages, interest, debarment, and class-action lawsuits. When the Department of Labor audits in three years, you need immutable audit trails, deterministic validation, and defensible decision logic. "Mostly works" isn't good enough.

### Three Layers, Each With Clear Responsibility

**Frontend (React 19)**
- Presentation only. Zero business logic.
- Testable with mocked Agent responses (MSW)

**Agent Gateway (TypeScript / Node.js / Hono / Mastra)** — The Integration Layer
- **Single external connection point** — SAM.gov APIs, security boundary
- **I/O-bound orchestration** — Node.js's event loop excels at concurrent API calls (Agent → Python → LLM → Response)
- **Middleware** — auth, rate limiting, request validation, CORS
- **Cross-service coordination** — orchestrates frontend, backend, and LLM reasoning
- **No state, no validation logic** — defers to Python for "provable correctness"

**Python Backend (FastAPI)** — The Deterministic Engine
- **Extraction** — pdfplumber for structured PDF parsing
- **Validation** — wage rules, overtime math, fringe calculations (deterministic, not LLM-based)
- **RAG** — hybrid retrieval (BM25 + vector + cross-encoder)
- **Testing infrastructure** — golden set, regression detection, LLM-as-judge scoring
- **Trust scores** — deterministic algorithm, reproducible, auditable

### Why V4 is Additive

V4 does not modify V3. All V4 modules live in new directories — no changes to V3 pipeline, validation, trust scoring, or API contracts. See [V3/V4 Boundary](docs/planning/V3_V4_BOUNDARY.md) for the clean handoff specification.

---

## Roadmap

**Phase 1 — Backend Core ✅**
Python deterministic pipeline. 89 unit tests. 9 API endpoints. 5 check functions. 20-trade DBWD corpus.

**Phase 2 — Data Layer + Infrastructure ✅**
PostgreSQL (pgvector), Redis cache, Elasticsearch BM25, hybrid RAG, Alembic migrations, seed scripts, Celery workers, Phoenix observability.

**Phase 3 — Agent Orchestration ✅**
Mastra.ai verdict agent, mock + real LLM paths, trust score computation, Langfuse tracing, JWT auth, 48 agent tests, full pipeline E2E.

**Phase 4 — Frontend ✅**
React 19 SPA with shadcn/ui. 7 pages, 12 components, TanStack Query hooks. PDF upload + text paste. Pipeline visualizer. Decision cards with trust scores. Analytics dashboard. Human review queue. Mock data layer (`VITE_MOCK_API=true`). ErrorBoundary. Skeleton loaders.

**Phase 5 — Integration + Evaluation ✅**
100-example golden set (structured + text), E2E integration tests, standalone smoke script, `eval.yml` scheduled workflow, enhanced `ci.yml` with Postgres/Redis service containers, sample WH-347 PDF fixture, ADR-010, README polish.

**Phase 6 / V3.1 — Multi-LLM Routing ✅**
Provider config (`LLM_PROVIDER` env var), LLM router with automatic fallback chain (OpenAI → Anthropic → Ollama), compliance-critical routing constraints, multi-provider Langfuse cost tracking, 11 router tests, baseline regression scores.

**V4 MVP — Enterprise Data Platform ✅ (Implemented)**
V4 adds enterprise-scale data management **on top of** V3 (not a rewrite):

- **Contract/Payroll Database** — PostgreSQL partitioned tables, full CRUD, millions of records
- **DuckDB OLAP Analytics** — In-process analytics engine reading live PostgreSQL + Parquet archives
- **Prefect ETL Scaffold** — Scheduled DBWD refresh, Parquet export, bulk ingestion orchestration
- **Redis Streams** — Real-time decision events streaming to analytics dashboard (< 500ms)
- **Great Expectations** — Data quality validation on every ingestion pipeline
- **Enterprise Connectors** — Extensible framework for SFTP, API, and database integration (V4.1)
- **Analytics Dashboard** — 4 Recharts pages (overview, compliance, wages, LLM cost/performance)

**V4.1 — Connector Ecosystem (Planned)**
Specific connectors: SFTP drops, ERP/HR API clients, direct DB read replicas.

---

## Documentation

- [Case Study](docs/case-study.md) — Full writeup: problem, architecture, pipeline, RAG, evaluation, lessons
- [Architecture Overview](docs/architecture.md) — V3 system design + V4 data platform overview
- [V4 Architecture](docs/architecture/v4-data-platform.md) — V4 module responsibilities and system design
- [V4 Data Model](docs/architecture/v4-data-model.md) — Full DDL, partitioning, Parquet schema
- [V4 Data Flows](docs/architecture/v4-data-flows.md) — Sequence diagrams for all 5 V4 data flows
- [V4 API Contract](docs/v4-api-contract.md) — V4 endpoint specifications with request/response examples
- [V4 Analytics Dashboard](docs/v4-analytics-dashboard.md) — Wireframe-level component specs
- [V3/V4 Boundary](docs/planning/V3_V4_BOUNDARY.md) — Clean handoff specification
- [Evaluation Pipeline](docs/evaluation.md)
- [ADRs](docs/adrs/) — Including [ADR-011 DuckDB OLAP](docs/adrs/ADR-011-duckdb-olap.md), [ADR-012 Prefect](docs/adrs/ADR-012-prefect-orchestration.md), [ADR-013 Redis Streams](docs/adrs/ADR-013-redis-streams.md), [ADR-014 Great Expectations](docs/adrs/ADR-014-great-expectations.md)
- [V4 Implementation Phases](docs/planning/v4-phases/) — 6 phase docs with V3-style detail
- [Compliance](docs/compliance/)
- [Changelog](CHANGELOG.md) — Release history
- [Contributing](CONTRIBUTING.md) — How to contribute
- [Security](SECURITY.md) — Security policy and responsible disclosure

---

## License

[MIT](LICENSE) © 2026 Vinícius Raposo
