# WCP Compliance Agent — v3

**Three-service AI decision engine for Davis-Bacon Act payroll compliance.**

Python backend × TypeScript agent × React frontend. Hybrid RAG. Full observability. Production-grade evaluation.

---

## By The Numbers (Phases 1–3 Complete)

- **3 services:** Python deterministic backend (✅), TypeScript agent (✅), React frontend (✅ scaffold)
- **5-step pipeline:** Extract → Validate → LLM Verdict → Trust Score → Persist (✅ end-to-end)
- **116 tests passing:** 87 backend unit + 29 agent (unit + integration)
- **9 API endpoints:** `/extract`, `/validate`, `/dbwd`, `/health`, `/decisions`, `/jobs`, `/search`, `/analytics`, `/auth`
- **5 check functions:** wage, fringe, overtime, signature, totals (with regulation citations)
- **20-trade DBWD corpus:** In-memory with fuzzy matching + Redis cache + PostgreSQL fallback
- **Mock mode:** Full pipeline runs without OpenAI key (`LLM_MODE=mock`)
- **JWT auth:** Login flow with bcrypt + jose, `AUTH_DISABLED` toggle for dev

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

## Quick Start

The supported path is WSL-native Ubuntu with all services installed locally:

```bash
# Clone
git clone https://github.com/FishRaposo/WCP-Compliance-Agent-V3.git
cd WCP-Compliance-Agent-V3

# Install system dependencies, native infra, and service dependencies
bash scripts/setup-wsl-native.sh

# Check whether the machine is ready
bash scripts/check-install.sh
```

See `docs/install.md` for the fresh-machine checklist, `docs/dependencies.md` for the full dependency inventory, and `docs/local-dev.md` for service-by-service commands.

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
| **Testing** | pytest, vitest, golden set eval | CI, regression detection |

---

## Project Structure

```
v3/
├── backend/              # Python FastAPI + deterministic pipeline
│   ├── src/
│   │   ├── api/         # FastAPI routers (9 endpoints)
│   │   ├── pipeline/    # Extraction, validation, checks
│   │   ├── retrieval/   # Hybrid RAG (BM25 + vector + rerank)
│   │   ├── services/    # DB, Redis, Celery tasks
│   │   └── models/      # SQLAlchemy + Pydantic
│   └── tests/
│       ├── eval/        # Golden set + regression
│       ├── integration/ # API endpoint tests
│       └── unit/        # Core logic tests (87 tests)
│
├── agent/                # TypeScript Mastra.ai agent
│   ├── src/
│   │   ├── mastra/      # Agents, tools, workflows
│   │   ├── api/         # Hono routes (7 route files)
│   │   ├── middleware/  # Auth, CORS, rate limiting
│   │   ├── langfuse/    # Tracing + cost tracking
│   │   └── prompts/     # Version registry + Langfuse
│   └── src/tests/       # 29 tests (unit + integration)
│
├── frontend/             # React 19 SPA
│   └── src/
│       ├── components/
│       ├── hooks/       # TanStack Query
│       └── pages/
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
- ✅ React 19 + Vite + Tailwind
- ✅ End-to-end type safety (Pydantic + Zod)
- ✅ WSL-native development (no Docker required)

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
Mastra.ai verdict agent, mock + real LLM paths, trust score computation, Langfuse tracing, JWT auth, 29 agent tests, full pipeline E2E.

**Phase 4 — Frontend** (Next)
React frontend, file upload, decision visualization, human review queue.

**Phase 5 — Integration + Evaluation**
Golden set regression testing, evaluation pipeline, full observability, production deploy.

**Future:**
- **V3.1:** Multi-LLM routing — Anthropic Claude + Ollama support, model-agnostic LLM layer
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

- [Architecture Overview](docs/architecture.md)
- [API Contract](docs/api-contract.md)
- [Evaluation Pipeline](docs/evaluation.md)
- [ADRs](docs/adrs/) — Including [excluded technologies](docs/adrs/ADR-009-excluded-technologies.md)
- [Compliance](docs/compliance/)

---

## License

MIT © 2026 Vinícius Raposo
