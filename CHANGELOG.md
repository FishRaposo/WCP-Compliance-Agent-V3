# Changelog

All notable changes to this project are documented in this file. Format based on [Keep a Changelog](https://keepachangelog.com/).

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
