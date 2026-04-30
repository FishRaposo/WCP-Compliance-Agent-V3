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
| **Tests** | 245+ passing (87 backend + 46 agent + 12 frontend + 100 golden set eval) |
| **Pipeline** | Extract → Validate → LLM Verdict → Trust Score → Persist |
| **LLM Routing** | OpenAI + Anthropic + Ollama with automatic fallback |
| **Frontend** | 7 pages, 12 components, mock mode for standalone dev |
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
└──────────────┬─────────────────────────────────────────────────────────────┘
               │ REST
┌──────────────▼──────────────────────────────────────────────────────────────┐
│  PYTHON BACKEND (FastAPI)                                                     │
│  Deterministic pipeline + Hybrid RAG + Celery + Phoenix                      │
│  Port: 8000                                                                  │
└──────────────┬─────────────────────────────────────────────────────────────┘
               │
         ┌─────▼──────┐
         │  DATA      │
         │  PostgreSQL│
         │  Redis     │
         │  ES + PG   │
         └────────────┘
```

---

## Demo

<!-- TODO: Add 3-4 screenshots of the frontend running in mock mode -->
<!-- Suggested: Dashboard overview, Analyze page with WH-347, Decision card with trust score, Analytics charts -->

> **Screenshots coming soon.** Run the frontend in mock mode to see the full UI:
> ```bash
> cd frontend && npm ci && VITE_MOCK_API=true npm run dev
> ```

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

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 19, Vite, Tailwind, Shadcn/ui, TanStack Query | Product UI |
| **Agent** | Hono, Mastra.ai, Vercel AI SDK, Langfuse, Phoenix | LLM orchestration |
| **Backend** | Python 3.12+, FastAPI, Pydantic v2, Celery, Flower | Deterministic logic, RAG |
| **Search** | Elasticsearch 8, pgvector, sentence-transformers | Hybrid retrieval |
| **Observability** | Phoenix/Arize, Langfuse, OpenTelemetry | Tracing, prompt infra, cost |
| **Testing** | pytest (100-example golden set), vitest, E2E smoke | CI, regression detection |

---

## Project Structure

```
v3/
├── backend/              # Python FastAPI + deterministic pipeline
│   ├── src/
│   │   ├── api/         # FastAPI routers (9 modules)
│   │   ├── pipeline/    # Extraction, validation, checks
│   │   ├── retrieval/   # Hybrid RAG (BM25 + vector + rerank)
│   │   ├── services/    # DB, Redis, Celery tasks
│   │   └── models/      # SQLAlchemy + Pydantic
│   └── tests/
│       ├── eval/        # Golden set (100 examples) + regression
│       ├── integration/ # API endpoint + E2E pipeline tests
│       ├── fixtures/    # Sample WH-347 PDF for tests
│       └── unit/        # Core logic tests (87 tests)
│
├── agent/                # TypeScript Mastra.ai agent
│   ├── src/
│   │   ├── mastra/      # Agents, tools, workflows
│   │   ├── api/         # Hono routes (9 route files)
│   │   ├── lib/         # Multi-LLM router + provider config
│   │   ├── middleware/  # Auth, CORS, rate limiting
│   │   ├── langfuse/    # Tracing + cost tracking
│   │   └── prompts/     # Version registry + Langfuse
│   └── src/tests/       # 46 tests (unit + integration + router)
│
├── frontend/             # React 19 SPA
│   └── src/
│       ├── components/  # 12 components + shadcn/ui primitives
│       ├── hooks/       # 6 TanStack Query hooks + SSE stream
│       ├── pages/       # 7 pages (Dashboard, Analyze, etc.)
│       ├── types/       # Shared API types
│       └── utils/       # API client + mock data layer
│
├── shared/               # JSON Schema contracts
│   └── schemas/
│
└── docs/
    ├── adrs/            # Architecture Decision Records
    ├── compliance/      # Regulatory docs
    └── evaluation.md    # Golden set + eval pipeline
```

---

## Architecture Highlights

### TypeScript Integration Layer
- ✅ Strong TypeScript (Hono + Mastra + React)
- ✅ Integration middleware (auth, rate limiting, validation)
- ✅ External API integration (SAM.gov)
- ✅ Agent orchestration with tool-use
- ✅ Cross-service coordination

### Python Backend
- ✅ Production backend (FastAPI + Celery)
- ✅ Hybrid RAG (BM25 + vector + cross-encoder)
- ✅ Testing infrastructure (golden set, CI regression)
- ✅ Deterministic validation layer
- ✅ CI-based evaluation

### Full-Stack Capabilities
- ✅ React 19 + Vite + Tailwind + shadcn/ui
- ✅ End-to-end type safety (Pydantic + Zod + TypeScript)
- ✅ WSL-native development (no Docker required)
- ✅ Mock data layer for frontend-only development

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
- **RAG** — hybrid retrieval (BM25 + vector + rerank)
- **Testing infrastructure** — golden set, regression detection, LLM-as-judge scoring
- **Trust scores** — deterministic algorithm, reproducible, auditable

### Why Node.js for the Integration Layer?

Node.js's async I/O model is genuinely better for orchestration work:
- Concurrent API calls (SAM.gov + Python backend + LLM) without blocking
- TypeScript's type safety catches contract mismatches at build time
- Middleware ecosystem (Hono, Express patterns) is production-ready

Python's GIL makes it less suited for I/O-bound coordination, but unmatched for CPU-bound data processing and deterministic validation.

### Why Python for the Validation Layer?

Federal compliance demands provable correctness:
- **pytest** — unmatched testing infrastructure (fixtures, parametrization, benchmarks)
- **Pydantic + FastAPI** — automatic validation, OpenAPI docs
- **pdfplumber, pandas, numpy** — mature data processing ecosystem
- **Reproducibility** — wage calculations must be identical every run

LLMs handle reasoning and synthesis. Python handles math and rules.

### This Is Not Over-Engineering

Three services, external API integration, golden set regression testing — this is **appropriate engineering for federal compliance**. The complexity provides:
- **Resilience** — If Python backend degrades, Node.js can queue/cache/fallback
- **Auditability** — Every decision cites specific regulation (40 U.S.C. § 3142)
- **Defensibility** — Immutable audit trail, deterministic validation, human review gates
- **Testability** — Each layer runs standalone with mocks

This architecture would hold up in a design review for medical devices, trading systems, or federal compliance platforms.

---

## Roadmap

**Phase 1 — Backend Core ✅**
Python deterministic pipeline. 87 unit tests. 9 API endpoints. 5 check functions. 20-trade DBWD corpus.

**Phase 2 — Data Layer + Infrastructure ✅**
PostgreSQL (pgvector), Redis cache, Elasticsearch BM25, hybrid RAG, Alembic migrations, seed scripts, Celery workers, Phoenix observability.

**Phase 3 — Agent Orchestration ✅**
Mastra.ai verdict agent, mock + real LLM paths, trust score computation, Langfuse tracing, JWT auth, 46 agent tests, full pipeline E2E.

**Phase 4 — Frontend ✅**
React 19 SPA with shadcn/ui. 7 pages, 12 components, TanStack Query hooks. PDF upload + text paste. Pipeline visualizer. Decision cards with trust scores. Analytics dashboard. Human review queue. Mock data layer (`VITE_MOCK_API=true`). ErrorBoundary. Skeleton loaders.

**Phase 5 — Integration + Evaluation ✅**
100-example golden set (structured + text), E2E integration tests, standalone smoke script, `eval.yml` scheduled workflow, enhanced `ci.yml` with Postgres/Redis service containers, sample WH-347 PDF fixture, ADR-010, README polish.

**Phase 6 / V3.1 — Multi-LLM Routing ✅**
Provider config (`LLM_PROVIDER` env var), LLM router with automatic fallback chain (OpenAI → Anthropic → Ollama), compliance-critical routing constraints, multi-provider Langfuse cost tracking, 11 router tests, baseline regression scores.

**Future:**
- **V4:** Enterprise data platform — Contract/payroll databases at scale, DuckDB OLAP, Prefect bulk ingestion

See [V3_PLAN.md](docs/planning/V3_PLAN.md) for full architecture spec.

---

## Target Outcomes

This project is designed to achieve specific measurable outcomes for AI compliance systems:

### Performance
- **< 5 second** end-to-end decision time (P99)
- **95%+** decision accuracy on federal wage compliance
- **100%** deterministic correctness on wage calculations

### Quality
- **Trust scores** that correlate with accuracy (ρ > 0.7)
- **90%+** citation coverage for legal defensibility
- **< 5%** false positive rate (minimizing wasted review)

### Cost
- **$0.05-0.15** per automated decision (vs. ~$0.50 manual review)
- **10× cost reduction** at equivalent accuracy

### Scale (V4)
- **Millions** of payroll records processed
- **Thousands** of active contracts monitored
- **Real-time** analytics across contract portfolios

These targets make the system production-credible and well-documented.

---

## Documentation

- [Case Study](docs/case-study.md) — Full writeup: problem, architecture, pipeline, RAG, evaluation, lessons
- [Architecture Overview](docs/architecture.md)
- [API Contract](docs/api-contract.md)
- [Evaluation Pipeline](docs/evaluation.md)
- [ADRs](docs/adrs/) — Including [ADR-010 React frontend](docs/adrs/ADR-010-react-frontend.md), [excluded technologies](docs/adrs/ADR-009-excluded-technologies.md)
- [Compliance](docs/compliance/)
- [Changelog](CHANGELOG.md) — Release history
- [Contributing](CONTRIBUTING.md) — How to contribute
- [Security](SECURITY.md) — Security policy and responsible disclosure

---

## License

[MIT](LICENSE) © 2026 Vinícius Raposo
