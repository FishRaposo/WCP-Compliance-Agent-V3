# Changelog

All notable changes to this project are documented in this file. Format based on [Keep a Changelog](https://keepachangelog.com/).

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
