# Changelog

All notable changes to this project are documented in this file. Format based on [Keep a Changelog](https://keepachangelog.com/).

## [4.0.0] - 2026-05-01

V4 MVP — Enterprise Data Platform. All V3 functionality unchanged; V4 adds an additive data platform layer.

### Added

#### Backend (Python)
- **Contract management** (`contracts/`): Full CRUD, SQLAlchemy 2.0 models, bulk CSV import, pagination and filtering
- **Payroll records** (`payrolls/`): Persistent storage with contract linkage, partitioned table model, bulk import service
- **Bulk ingestion** (`ingestion/`): CSV/PDF document processors, batch pipeline, per-record error reporting, job status tracking
- **DuckDB analytics** (`analytics/`): In-process OLAP queries, PostgreSQL + Parquet reads, cross-contract aggregations (decision volume, compliance breakdown, wage analytics, LLM cost/performance)
- **Prefect ETL scaffold** (`pipelines/`): DBWD refresh flow, Parquet export flow, bulk ingest orchestration, shared task utilities
- **Redis Streams producer** (`events/`): `emit_decision_event()` on decision persist, DecisionEvent Pydantic model, consumer group support
- **Great Expectations** (`quality/`): Validation suites for DBWD rates, contracts, and payroll records; quarantine reporting
- **Connector framework** (`connectors/`): BaseConnector ABC, SFTP/API/Database connector stubs, registry for discovery
- **Parquet storage** (`storage/`): Decision archiving to columnar Parquet, MD5 integrity, DuckDB external table registration
- **Analytics router** (`analytics/router.py`): FastAPI endpoints (`/analytics/decision-volume`, `/analytics/compliance`, `/analytics/wages`, `/analytics/llm`, `/analytics/overview`)

#### Agent (TypeScript)
- **V4 route files** (`api/v4/`): 6 new files — `contracts.ts`, `payrolls.ts`, `ingestion.ts`, `analytics.ts`, `proxy.ts`, `index.ts`
- **Event consumer** (`events/`): Redis Streams consumer (`XREADGROUP`), SSE push to frontend analytics pages
- **Contract proxy routes**: `GET/POST /api/contracts`, `POST /api/contracts/bulk`, `PUT/DELETE /api/contracts/:id`
- **Payroll proxy routes**: `GET /api/payrolls`, `POST /api/payrolls/bulk`
- **Ingestion proxy routes**: `GET /api/ingestion/status/:job_id`, `GET /api/ingestion/jobs`, `POST /api/bulk-upload`
- **Analytics proxy routes**: `GET /api/analytics/decision-volume`, `/api/analytics/compliance`, `/api/analytics/wages`, `/api/analytics/llm`, `/api/analytics/overview`
- **Event streaming**: `GET /api/events/subscribe` SSE endpoint

#### Frontend (React)
- **Analytics pages** (`pages/analytics/`): 4 Recharts-based pages — overview, compliance, wages, LLM cost/performance
- **Analytics components** (`components/analytics/`): 11 chart components — DecisionVolumeChart, ApprovalRateChart, FringeComplianceChart, TopViolationsChart, WageViolationTrendChart, ActualVsRequiredScatter, ApprovalRateByTradeChart, ApprovalRateByLocality, LatencyByModelChart, ModelDistributionChart, TokenUsageChart; plus KPICard, ChartCard, LiveFeed, AnalyticsLayout
- **Contracts page** (`pages/contracts/`): Contract management UI with table, filters, status badges
- **Payrolls page** (`pages/payrolls/`): Payroll record browser with contract filter, pagination
- **Ingestion page** (`pages/ingestion/`): ETL job monitoring with progress indicators, error details, retry actions

### Changed
- README: V4 described as implemented MVP (not "planned"); feature matrix, usage flow, CSV examples, validation commands, infrastructure limitations added
- AGENTS.md: V4 commands clarified as MVP (not "planned"); V3/V4 boundary clarified with additive route registration note

### Tests
- Backend V4 unit tests: `test_v4_scaffold.py` (DuckDB analytics, events, storage, connectors, contracts, payrolls, ingestion), `test_payrolls.py`, `test_quality.py`, `test_ingestion.py`
- Agent V4 integration tests: `v4-integration.test.ts` and `v4-scaffold.test.ts` (48 agent tests total including V4)
- Frontend V4 scaffold tests: `v4-scaffold.test.ts` and `v4-pages.test.tsx`

### Limitations (Infrastructure-Dependent)

| Dependency | Required For | Degrades To |
|---|---|---|
| PostgreSQL 16 | All V4 modules | Inoperable |
| Redis 7 | Events, ETL state | Events silent; jobs not tracked |
| DuckDB | Analytics queries | Empty datasets |
| Prefect | ETL scheduling | Manual trigger only |
| Great Expectations | Ingestion validation | Pass-through (no quarantine) |
| Elasticsearch 8 | V3 RAG only | V4 CRUD unaffected |

## [3.1.1] - 2026-04-28

### Added
- Frontend test suite: 12 tests across 4 files (Login, TrustScoreBadge, apiClient, App routing)
- Frontend vitest.config.ts and setupTests.ts infrastructure
- Agent HTTP route tests: health, auth/login, analyze endpoints
- Agent auth middleware tests: JWT signing, AUTH_DISABLED bypass
- Backend centralized table definitions (`services/tables.py`)
- Backend config production validation (rejects localhost URLs in production)
- Backend SAM.gov ETL pipeline (`scripts/etl_sam_gov.py`): fetch → validate → upsert
- Backend graph.py `to_dict()` serialization for Phoenix/audit traces
- Agent external API rate limiter with token bucket implementation
- Backend Dockerfile (multi-stage Poetry build)
- Agent Dockerfile (multi-stage esbuild bundle)
- render.yaml (Render Blueprint for backend + agent)
- vercel.json (Vercel config for frontend)
- `@testing-library/user-event` and `jsdom` as frontend dev dependencies

### Changed
- Deduplicated inline SQLAlchemy Table() definitions from decisions.py, analytics.py, auth.py, jobs.py into shared `services/tables.py`
- Fixed `users_table` missing `created_at` column to match migration 005
- `db.py init_db()` now verifies database connectivity with `SELECT 1`
- Agent CORS middleware re-exports from config.ts (removed hardcoded duplicate)
- `dbwd_lookup.py` docstring updated to reference SAM.gov ETL script
- deploy.yml: added pre-deploy build verification and post-deploy health checks
- ci.yml: added `npm test` step to frontend job
- Root `.env.example` updated with production checklist comments

### Removed
- 5 TODO comments from production source code (all resolved)

### Fixed (V3.1.1 Finalization)
- TypeScript type errors in `sam_gov.ts` and `dol_wdo.ts` (string/number conversions)
- Removed dead code: unused `TRUST_BAND_COLORS` from Analytics.tsx, `getVerdictStyle` from Dashboard.tsx
- Fixed backend `dbwd.py` import error (`get_dbwd_rate_service` → `get_dbwd_rate`)
- Removed unused `AsyncMock` import from `test_api_phase1.py`
- Fixed all ruff lint errors (F401 unused imports, F821 undefined name)
- Fixed all agent eslint errors (unused imports, const vs let, test file any types)
- Fixed frontend eslint error (unused `_init` parameter in `api-client.ts`)
- Added missing `typescript-eslint` to frontend devDependencies
- Added missing `eslint.config.js` and `globals` to agent devDependencies

## [3.1.0] - 2026-04-28

### Added
- Multi-LLM routing: OpenAI, Anthropic, Ollama with automatic fallback chain
- Provider config (`agent/src/lib/provider-config.ts`) with dynamic env var reading
- LLM router (`agent/src/lib/llm-router.ts`) with context-based provider selection
- Compliance-critical routing constraint: Ollama never used for compliance decisions
- Multi-provider Langfuse cost tracking (Claude, Opus, Llama, Mistral models)
- 11 LLM router unit tests
- Baseline regression scores (`backend/tests/eval/baseline_scores.json`)
- Baseline generation script (`backend/scripts/generate_baseline.py`)
- `LLM_PROVIDER` env var for switching providers without code changes
- `@ai-sdk/anthropic` and `ollama-ai-provider` dependencies

### Changed
- Verdict agent (`wcp-verdict.ts`) uses LLM router instead of direct OpenAI calls
- Agent config schema extended with multi-LLM environment variables
- Updated documentation across all services

## [3.0.0] - 2026-04-28

### Phase 5 — Integration + Evaluation
- 100-example golden set (`golden_set.json`) with structured JSON evaluation
- 75-example text golden set with separate test runner
- E2E integration test and standalone smoke script
- `eval.yml` scheduled CI workflow (weekly Monday)
- Enhanced `ci.yml` with Postgres + Redis service containers
- Sample WH-347 PDF fixture for tests

### Phase 4 — Frontend
- React 19 SPA with 7 pages and 12 components
- shadcn/ui primitives (Button, Card, Badge, Skeleton, Input, Select, etc.)
- TanStack Query hooks with SSE decision stream
- Mock data layer (`VITE_MOCK_API=true`) for standalone development
- PDF upload + text paste via UploadDropzone
- ErrorBoundary and skeleton loading states

### Phase 3 — Agent Orchestration
- Mastra.ai verdict agent with mock + real LLM paths
- Trust score computation (4-component weighted formula)
- Langfuse tracing and cost tracking
- JWT authentication with bcrypt + jose
- 29 agent tests (unit + integration)
- Full pipeline E2E flow

### Phase 2 — Data Layer + Infrastructure
- PostgreSQL 16 with pgvector and Alembic migrations
- Redis cache with 24h TTL for DBWD rates
- Elasticsearch 8 BM25 search
- Hybrid RAG: BM25 + vector + cross-encoder reranking
- Celery workers for async batch processing
- Phoenix/Arize observability
- Seed scripts for DBWD, Elasticsearch, and vectors

### Phase 1 — Backend Core
- Python FastAPI deterministic pipeline
- 5 compliance checks: wage, fringe, overtime, totals, signature
- 20-trade DBWD corpus with fuzzy matching
- PDF extraction via pdfplumber
- 87 unit tests
- 9 API router modules

## [2.0.0] - 2025 (Archived)

V2 was a monolithic Node.js implementation. Archived in `_archive/` and superseded by the three-service V3 architecture. See [V2_TO_V3_TRANSITION.md](docs/planning/V2_TO_V3_TRANSITION.md) for the architectural evolution narrative.
