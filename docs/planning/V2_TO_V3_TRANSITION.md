# V2 → V3 Transition Guide

**Date:** 2026-04-22
**Status:** V2 in final pass, V3 planning phase

---

## Philosophy: From Proof-of-Concept to Production Architecture

### V2: The TypeScript Monolith (Proof-of-Concept)

V2 demonstrated that LLM-based compliance checking was feasible. A single TypeScript codebase handled extraction, LLM reasoning, and a React frontend. It proved the concept, but wasn't production-ready for federal compliance.

**V2's limitations:**
- Single language forced compromises (TypeScript for math-heavy validation)
- No separation between LLM reasoning and deterministic validation
- Stubbed retrieval (ES/pgvector never fully connected)
- In-memory job queue (lost on restart)
- Testing infrastructure insufficient for regression detection

### V3: Production Architecture for Federal Compliance

Federal wage compliance demands more than "it works most of the time." Davis-Bacon Act violations carry back wage penalties, interest, and contractor debarment. The Department of Labor can audit 7 years back. You need deterministic validation, immutable audit trails, and defensible decision logic.

**V3's architectural maturation:**

| Concern | V2 Approach | V3 Approach | Why V3 Wins |
|---|---|---|---|
| **External APIs** | Direct calls from monolith | Node.js integration layer | Single security boundary, better I/O concurrency |
| **Validation** | LLM-based | Python deterministic | Math must be exact, not "mostly right" |
| **Testing** | Unit tests only | Golden set + CI regression | Can't deploy broken wage calculations |
| **Retrieval** | Stubbed | Hybrid RAG (BM25 + vector + rerank) | Real compliance requires real precedent lookup |
| **Job Queue** | In-memory | Celery + Redis | Persistent, recoverable, monitorable |
| **Observability** | Basic logging | Phoenix + Langfuse + OTel | Production debugging, prompt versioning, cost tracking |

### Language Polyglotism: Right Tool for Right Job

V3 splits by concern, not by convenience:
- **Node.js/TypeScript** — I/O-bound integration layer (external APIs, middleware, orchestration)
- **Python** — CPU-bound validation layer (extraction, math, rules, testing)
- **React** — Presentation layer (UI only)

Node.js's event loop handles concurrent API calls efficiently. Python's ecosystem handles rigorous data validation and testing. Each language where it performs best.

This isn't "adding complexity" — it's **appropriate engineering for federal compliance**.

### Repository Structure

**v2 repo:** `FishRaposo/WCP-Compliance-Agent` — becomes the archived monolith proof-of-concept. Tag it `v2.0.0` before moving on.

**v3 repo:** New clean repository — only the architecture we actually need, no stubbed features, no legacy debt.

---

## What to Port from v2 → v3

All V2 source files live in `_archive/` in the V3 repository. Reference them by their full path when implementing V3.

### Core Logic (Must Port)

| Source (in `_archive/`) | Destination (v3) | Key functions | What It Is |
|---|---|---|---|
| `_archive/src/pipeline/layer1-deterministic.ts` | `backend/src/wcp_backend/pipeline/extraction.py` | `extractWCPData()`, `resolveClassification()` | Deterministic extraction — ~20 regex patterns, field extraction, classification aliasing |
| `_archive/src/pipeline/layer1-deterministic.ts` | `backend/src/wcp_backend/pipeline/checks/*.py` | `checkPrevailingWage()`, `checkOvertimeCompliance()`, `checkFringeBenefits()`, `checkSignature()`, `checkTotalHours()`, `checkDataIntegrity()`, `checkMinimumWageSanity()` | 8 rule checks with statutory citations |
| `_archive/src/pipeline/layer3-trust-score.ts` | `backend/src/wcp_backend/pipeline/rules.py` | `computeTrustComponents()`, `computeAgreement()`, `determineTrustBand()` | Trust formula — weights (0.35/0.25/0.20/0.20), band thresholds (0.85/0.60) |
| `_archive/src/types/decision-pipeline.ts` | `backend/src/wcp_backend/models/schemas.py` + `agent/src/types/index.ts` | All Zod schemas | WH-347 data model — use to verify Pydantic/Zod field completeness |
| `_archive/data/dbwd-corpus.json` | Seed data in `backend/scripts/seed_dbwd.py` | — | 20-trade in-memory DBWD corpus (development fallback) |
| `_archive/src/retrieval/hybrid-retriever.ts` | `backend/src/wcp_backend/services/redis_cache.py` | `IN_MEMORY_ALIASES`, `fuzzyMatchTrade()` | 40+ trade alias variants + Levenshtein fuzzy matching |
| `_archive/src/services/dbwd-retrieval.ts` | `backend/src/wcp_backend/pipeline/dbwd_lookup.py` | `levenshtein()` | Edit distance fuzzy matching for unknown trade names |
| `_archive/src/prompts/versions/wcp-verdict-v2.ts` | `agent/src/prompts/versions/wcp-verdict-v2.ts` | Template string | Production-validated Layer 2 prompt — do not rewrite from scratch |
| `_archive/src/pipeline/layer2-llm-verdict.ts` | `agent/src/mastra/agents/wcp-verdict.ts` | `layer2LLMVerdict()` | LLM call pattern — Zod output validation, fallback text extraction, `referencedCheckIds` constraint |
| `_archive/src/utils/mock-responses.ts` | `agent/src/config.ts` | `isMockMode()`, `generateMockWcpDecision()` | Offline testing without OpenAI (`OPENAI_API_KEY=mock`) |
| `_archive/tests/eval/golden-set.ts` | `backend/tests/eval/golden_set.json` | All examples | Labeled evaluation set — port all passing examples to JSON format |

### Regulatory Knowledge (Already migrated)

V3 compliance docs were written from the V2 implementation. The V2 archive may contain earlier versions:

| Source (in `_archive/`) | V3 destination | Status |
|---|---|---|
| `_archive/docs/compliance/` | `docs/compliance/traceability-matrix.md` | ✅ Rewritten for V3 |
| `_archive/docs/compliance/` | `docs/compliance/regulatory-compliance-report.md` | ✅ Rewritten for V3 |

### Configuration (Evolve)

| Source (in `_archive/`) | Destination (v3) | What It Is |
|---|---|---|
| `_archive/.env.example` | `.env.example` (root) | V3 unifies into one root `.env.example`; service-specific vars are prefixed |
| `_archive/wcp.config.json` | Embed in `backend/src/wcp_backend/config.py` as defaults | Runtime DBWD corpus override config |

---

## What to Leave Behind (Archive in v2)

### Entire Directories — Do Not Port

| v2 Directory | Why Not Port |
|---|---|
| `src/retrieval/` | Stubbed — ES/pgvector never connected. v3 will build retrieval fresh with Python |
| `src/frontend/` | React 18 monolithic — v3 will be React 19 + Vite + Shadcn/ui from scratch |
| `src/services/job-queue.ts` | In-memory only — v3 uses Celery + Redis |
| `src/services/audit-persistence.ts` | v3 will use SQLAlchemy 2.0 async + Alembic |
| `src/ingestion/pdf-ingestion.ts` | `pdf-parse` is buggy — v3 uses Python `pdfplumber` |
| `src/ingestion/csv-ingestion.ts` | `papaparse` works but v3 Python `pandas`/`polars` is better |
| `api/` | Vercel serverless functions — v3 is containerized services |
| `tests/unit/coverage-gaps.test.ts` | Tests stubbed retrieval — irrelevant in v3 |
| `tests/unit/hybrid-retriever.test.ts` | Tests stubbed retrieval — irrelevant in v3 |
| `tests/unit/bm25-search.test.ts` | Tests ES module that never loads — irrelevant in v3 |
| `scripts/lint-pipeline-discipline.ts` | v2-specific architectural lint — v3 needs new lint rules |

### Specific Files — Do Not Port

| v2 File | Why Not Port |
|---|---|
| `src/app.ts` | Hono app with v2 routes — v3 has separate backend (`backend/src/main.py`) and agent (`agent/src/app.ts`) |
| `src/server.ts` | v2 entrypoint — v3 has 3 entrypoints (Python, TS agent, Vite dev server) |
| `src/pipeline/orchestrator.ts` | v2 orchestrator — v3 agent uses Mastra.ai |
| `src/pipeline/layer3-trust-score.ts` | Port the formula but rewrite in Python |
| `src/pipeline/layer2-llm-verdict.ts` | Port prompt template but rewrite with Mastra.ai |
| `src/utils/errors.ts` | v2 error types — v3 uses Python exceptions + TS error classes |
| `src/utils/logger.ts` | pino setup — v3 uses Python `structlog` + TS `pino` |
| `src/utils/env-validator.ts` | v2-specific env — v3 uses Pydantic Settings + dotenv |
| `src/utils/mock-responses.ts` (all) | In-memory corpus is the only thing to port — the rest of mock responses are test infrastructure |
| `src/instrumentation.ts` | OTel setup — v3 uses Python OTel + TS OTel separately |
| `vite.config.ts` | v2 Vite config — v3 frontend needs fresh config |
| `tsconfig.backend.json` | v2 TypeScript config — v3 has separate TS configs per service |
| `tsconfig.frontend.json` | v2 TypeScript config — v3 frontend uses new config |
| `.github/workflows/pipeline-discipline.yml` | v2 CI — v3 needs multi-stack CI (Python + TypeScript + React) |
| `docker-compose.yml` | v2 has PostgreSQL + Phoenix + all services |
| `vercel.json` | Vercel deployment — v3 is Docker/containerized |

---

## v3 Directory Layout (Proposed)

```
wcp-compliance-agent-v3/           # New repo
├── README.md
├── LICENSE
├── docker-compose.yml               # Full stack: PG, Redis, ES, Phoenix, backend, agent, frontend
├── Makefile                         # Common tasks: dev, test, lint, migrate
├── .github/
│   └── workflows/
│       ├── ci.yml                   # Unified CI: Python tests, TS tests, frontend build
│       └── eval.yml                 # Golden set regression — hard-fail on drift
│
├── backend/                         # Python deterministic brain
│   ├── pyproject.toml               # Poetry dependencies
│   ├── README.md
│   ├── .env.example
│   ├── src/
│   │   ├── main.py                  # FastAPI app factory
│   │   ├── config.py                # Pydantic Settings (env + yaml)
│   │   ├── extraction/              # Layer 1: field extraction (ported from v2)
│   │   │   ├── __init__.py
│   │   │   ├── patterns.py          # Regex patterns from v2
│   │   │   └── wh347.py             # WH-347 parser
│   │   ├── validation/              # Layer 1: rule checks (ported from v2)
│   │   │   ├── __init__.py
│   │   │   ├── wage.py              # Wage checks
│   │   │   ├── overtime.py          # Overtime checks
│   │   │   ├── fringe.py            # Fringe checks
│   │   │   ├── classification.py    # Classification checks
│   │   │   └── signature.py         # Signature checks
│   │   ├── corpus/                  # DBWD rate data
│   │   │   ├── __init__.py
│   │   │   ├── in_memory.py         # 20-trade fallback (ported from v2)
│   │   │   └── hybrid_retrieval.py  # BM25 + vector + rerank (new)
│   │   ├── models/                  # SQLAlchemy 2.0 models
│   │   │   ├── __init__.py
│   │   │   ├── decision.py          # Decision, AuditEvent tables
│   │   │   └── job.py               # Job queue tables
│   │   ├── api/                     # FastAPI routers
│   │   │   ├── __init__.py
│   │   │   ├── decisions.py         # POST /decisions, GET /decisions/:id
│   │   │   ├── extract.py           # POST /extract
│   │   │   ├── validate.py          # POST /validate
│   │   │   ├── dbwd.py              # GET /dbwd-rate/:trade/:locality
│   │   │   └── health.py            # GET /health
│   │   ├── services/                # Business logic
│   │   │   ├── __init__.py
│   │   │   ├── decision_service.py  # Orchestrate extraction → validation → persist
│   │   │   └── retrieval_service.py # Hybrid DBWD lookup
│   │   ├── tasks/                   # Celery background tasks
│   │   │   ├── __init__.py
│   │   │   └── process_decision.py  # Async decision processing
│   │   └── instrumentation.py       # OpenTelemetry setup
│   ├── migrations/                  # Alembic SQL migrations
│   │   ├── env.py
│   │   ├── versions/
│   │   └── 001_initial.py           # Port from v2 migration
│   ├── tests/
│   │   ├── conftest.py              # pytest fixtures
│   │   ├── unit/
│   │   │   ├── test_extraction.py   # Port from v2 extraction tests
│   │   │   ├── test_validation.py   # Port from v2 validation tests
│   │   │   └── test_models.py       # SQLAlchemy model tests
│   │   ├── integration/
│   │   │   └── test_api.py          # FastAPI endpoint tests
│   │   └── eval/
│   │       ├── golden_set.json      # Port 100 examples from v2
│   │       └── test_golden_set.py   # CI hard-fail regression
│   └── Dockerfile                   # Python 3.12 slim
│
├── agent/                           # TypeScript LLM orchestration
│   ├── package.json
│   ├── tsconfig.json
│   ├── README.md
│   ├── .env.example
│   ├── src/
│   │   ├── app.ts                   # Hono app
│   │   ├── config.ts                # Zod env validation
│   │   ├── mastra/
│   │   │   ├── index.ts             # Mastra instance setup
│   │   │   ├── agents/
│   │   │   │   └── wcp-agent.ts     # Layer 2: LLM verdict agent
│   │   │   └── tools/
│   │   │       ├── extract.ts       # Call Python /extract endpoint
│   │   │       ├── validate.ts      # Call Python /validate endpoint
│   │   │       └── dbwd_lookup.ts   # Call Python /dbwd-rate endpoint
│   │   ├── prompts/
│   │   │   ├── wcp-verdict.ts       # Prompt template (ported from v2)
│   │   │   └── versions/
│   │   │       └── v2.ts            # wcp-verdict-v2
│   │   ├── types/
│   │   │   └── index.ts             # Shared TS types (Zod schemas)
│   │   └── instrumentation.ts       # OpenTelemetry + Langfuse
│   ├── tests/
│   │   ├── unit/
│   └── integration/
│   └── Dockerfile                   # Node 20 slim
│
├── frontend/                        # React 19 product UI
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── README.md
│   ├── .env.example
│   ├── src/
│   │   ├── main.tsx                 # Entry point
│   │   ├── App.tsx                  # Router + layout
│   │   ├── components/
│   │   │   ├── DecisionForm.tsx     # Submit WCP for analysis
│   │   │   ├── DecisionDetail.tsx   # Show full 3-layer breakdown
│   │   │   ├── DecisionList.tsx     # List all decisions
│   │   │   ├── Layer1Panel.tsx      # Deterministic findings
│   │   │   ├── Layer2Panel.tsx      # LLM verdict
│   │   │   ├── Layer3Panel.tsx      # Trust score + audit trail
│   │   │   └── UploadForm.tsx       # PDF/CSV upload
│   │   ├── hooks/
│   │   │   └── useDecisions.ts      # TanStack Query hooks
│   │   ├── lib/
│   │   │   └── api.ts               # API client (agent endpoints)
│   │   └── types/
│   │       └── index.ts             # Frontend types
│   ├── tests/
│   │   └── e2e/
│   │       └── decision-flow.spec.ts  # Playwright E2E
│   └── Dockerfile                   # nginx static serve
│
├── shared/                          # Cross-service contracts
│   ├── schemas/
│   │   ├── wcp.ts                   # Zod schemas (source of truth)
│   │   ├── wcp.py                   # Pydantic models (generated from Zod)
│   │   └── generate.py              # codegen: Zod → Pydantic
│   └── types/
│       └── index.d.ts               # Shared TypeScript types
│
└── docs/
    ├── architecture/
    │   ├── system-overview.md
    │   ├── decision-pipeline.md
    │   ├── api-contract.md          # REST contract between services
    │   └── v3-plan.md               # This document
    ├── compliance/
    │   ├── traceability-matrix.md   # Port from v2
    │   └── regulatory-report.md     # Port from v2
    ├── development/
    │   ├── setup.md
    │   ├── testing.md
    │   └── contributing.md
    └── adr/                         # Architecture Decision Records
        ├── 001-python-backend.md
        ├── 002-mastra-agent.md
        ├── 003-react-frontend.md
        └── 004-monorepo-structure.md
```

---

## Transition Checklist

### Phase 0: Prep (1 day)

- [ ] Tag v2 repo: `git tag -a v2.0.0 -m "TypeScript monolith proof-of-concept" && git push origin v2.0.0`
- [ ] Create new v3 repository on GitHub (or keep same org, new name)
- [ ] Initialize v3 repo with README, LICENSE, .gitignore
- [ ] Set up branch protection rules for `main`
- [ ] Copy regulatory docs (`docs/compliance/`) from v2
- [ ] Copy golden set (`tests/eval/golden-set.ts` → `backend/tests/eval/golden_set.json`)

### Phase 1: Backend Skeleton (2–3 days)

- [ ] `cd backend && poetry init` — FastAPI, asyncpg, SQLAlchemy 2.0, Pydantic, pytest
- [ ] FastAPI app factory (`backend/src/main.py`)
- [ ] Pydantic Settings config (`backend/src/config.py`)
- [ ] Port deterministic extraction patterns from v2 (`backend/src/extraction/patterns.py`)
- [ ] Port validation checks from v2 (`backend/src/validation/*.py`)
- [ ] Port in-memory DBWD corpus from v2 (`backend/src/corpus/in_memory.py`)
- [ ] SQLAlchemy models (`backend/src/models/decision.py`)
- [ ] Alembic migrations (port from v2 SQL)
- [ ] API routers: `/extract`, `/validate`, `/dbwd-rate`, `/decisions`
- [ ] pytest suite with golden set regression
- [ ] Dockerfile for backend

### Phase 2: Agent Skeleton (2 days)

- [ ] `cd agent && npm init` — Hono, Mastra.ai, Vercel AI SDK, Zod, pino
- [ ] Hono app with health endpoint
- [ ] Mastra agent setup with tools calling Python backend
- [ ] Port prompt template from v2 (`agent/src/prompts/wcp-verdict.ts`)
- [ ] Zod schemas for agent types
- [ ] Langfuse integration (prompt versioning, tracing)
- [ ] Dockerfile for agent

### Phase 3: Frontend Skeleton (2 days)

- [ ] `cd frontend && npm create vite@latest` — React 19, TypeScript
- [ ] Install Tailwind CSS + Shadcn/ui
- [ ] TanStack Query setup
- [ ] Decision form, detail, list components
- [ ] Upload form (PDF/CSV)
- [ ] Dockerfile for frontend (nginx)

### Phase 4: Integration (2 days)

- [ ] Docker Compose: PostgreSQL + Redis + backend + agent + frontend
- [ ] REST API contract documentation
- [ ] End-to-end test: submit WCP → get 3-layer decision
- [ ] Golden set regression in CI (Python tests)
- [ ] OpenTelemetry tracing across all 3 services
- [ ] CI/CD: GitHub Actions for Python + TypeScript + React

### Phase 5: Polish (1–2 days)

- [ ] README with architecture diagram
- [ ] Quick start guide
- [ ] CONTRIBUTING.md
- [ ] ADRs for v3 decisions
- [ ] Performance baseline (latency, throughput)
- [ ] Tag v3.0.0-alpha

---

## Risk: What If v3 Takes Longer?

**Fallback:** v2 repo remains perfectly usable as a proof-of-concept. If v3 timeline extends:

1. v2 demonstrates rapid prototyping — working monolith architecture
2. v3 docs demonstrate production systems thinking — detailed architecture planning for regulated infrastructure
3. Having both shows range: shipping fast and designing for scale

**v2 is not broken — it's a different scope.** V2 shows rapid prototyping in 2 weeks. V3 shows designing a multi-service architecture for safety-critical infrastructure.

---

## Decision: Same Repo or New Repo?

| Approach | Pros | Cons |
|---|---|---|
| **New repo** (recommended) | Clean slate, no legacy debt, clear separation of concerns, v2 stays archived and tagged | Two repos to maintain, link between them |
| **Same repo, `v3` branch** | Single repo history, easy to compare branches, PR-based migration | Branch will diverge massively, messy git history, v2 main becomes stale |

**Recommendation:** New repo. Call it `wcp-compliance-agent` (drop the "-v3" suffix — this is the real one). Archive v2 with a final tag and README note.

---

*Generated: 2026-04-22*
