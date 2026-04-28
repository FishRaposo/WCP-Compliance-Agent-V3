# WCP Compliance Agent — v3 Architecture Plan

**Date:** 2026-04-22
**Scope:** Full refactor from v2 TypeScript monolith → Python + TypeScript + React + Everything
**Note:** This is a historical planning document. Docker references below are from the original design; the project now uses WSL-native infrastructure only. Docker artifacts have been removed.

**Version History:**
- **v1:** Original Mastra.ai build (deprecated)
- **v2:** TypeScript monolith — compiles clean, Phase 01 PoC complete
- **v3:** Ground-up rewrite — three-service architecture (Python + TypeScript + React)
- **v3.1:** Extension of v3 — Multi-LLM routing (Anthropic + Ollama), model-agnostic LLM layer
- **v4:** Extension of v3 — Data platform layer (NOT a rewrite). Adds: contract/payroll databases at scale, DuckDB analytics, Prefect bulk ingestion, enterprise middleware. V3 core unchanged.

**Philosophy:** This is a production-ready architecture plan for a multi-service AI compliance platform. Every technology choice serves a specific architectural purpose: deterministic backend logic, agent orchestration, hybrid search, prompt versioning, and full observability. The architecture is designed for regulated industries where every AI decision must be explainable, traceable, and defensible.

**Why This Separation?**

Federal wage compliance demands provable correctness, not "mostly right." The architecture separates:
- **I/O-bound orchestration** (Node.js) — external APIs, middleware, cross-service coordination
- **CPU-bound validation** (Python) — extraction, math, rules, testing infrastructure
- **Presentation** (React) — UI only, no business logic

Node.js's event loop excels at concurrent API calls. Python's ecosystem excels at deterministic data processing and rigorous testing. Each language where it performs best.

**Resilience for Federal Regulations**

Davis-Bacon Act violations carry DOL penalties and contractor debarment. The architecture provides defense in depth:
- Three layers = clear boundaries, no accidental direct calls
- Python validation layer = deterministic math, not LLM guesses
- Trust score gates = high-stakes decisions route to human review
- Golden set regression = broken wage calculations can't deploy
- Immutable audit trail = legally defensible in DOL audit

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  REACT 19 FRONTEND (TypeScript)                                              │
│  Vite + Tailwind + Shadcn/ui + TanStack Query                                │
│  Modern product UI — multi-employee accordion, real-time pipeline viz        │
│  Directory: frontend/                                                        │
└────────────────────────────┬─────────────────────────────────────────────────┘
                             │ HTTP / REST + SSE (real-time updates)
┌────────────────────────────▼─────────────────────────────────────────────────┐
│  API GATEWAY + AGENT ORCHESTRATION (TypeScript/Node)                        │
│  Hono (lightweight, FastAPI-equivalent for Node)                             │
│  Mastra.ai v0.x — agent framework with tool-use + structured output          │
│  Langfuse integration — prompt versioning, cost tracking, eval traces        │
│  Directory: agent/                                                           │
└──────────────┬────────────────────────────┬───────────────────────────────────┘
               │                            │
               │ REST / gRPC (future)       │ External APIs
               ▼                            ▼
┌──────────────────────────────┐  ┌──────────────────────────────────────┐
│  DETERMINISTIC BACKEND       │  │  EXTERNAL SERVICES                   │
│  (Python)                    │  │  • OpenAI API (GPT-4o / o3-mini)     │
│  FastAPI + Pydantic v2       │  │  • Elasticsearch (BM25)            │
│  Async PostgreSQL (asyncpg)  │  │  • pgvector (dense retrieval)       │
│  Redis (redis.asyncio)       │  │  • SAM.gov Wage Determinations       │
│  Phoenix/Arize (observability)│ │  • DOL Wage Determinations Online    │
│  pytest + golden set eval    │  │  • Salesforce CRM (future)           │
│  Celery (async task queue)   │  │  • Redshift analytics (future)       │
│  Directory: backend/         │  │                                      │
└──────────────┬───────────────┘  └──────────────────────────────────────┘
               │
               ▼
        ┌──────────────────┐
        │  DATA LAYER      │
        │  • PostgreSQL 16 │
        │  • pgvector ext  │
        │  • Redis 7       │
        │  • Elasticsearch 8│
        │  • (Future: Neo4j graph DB)│
        └──────────────────┘
```

---

## Full Tech Stack

| Layer | Technology | Architectural Purpose |
|---|---|---|
| **Frontend** | React 19, Vite, Tailwind, Shadcn/ui, TanStack Query | Modern product UI with real-time updates |
| **Integration Layer** | Hono, TypeScript, ESM, Middleware patterns | Node.js backend for concurrent API orchestration |
| **Agent Orchestration** | Mastra.ai, Vercel AI SDK, OpenAI GPT-4o / o3-mini | LLM tool-use with structured output |
| **Prompt Infra** | Langfuse (versioning, A/B, cost tracking) | Production prompt management and cost tracking |
| **Observability** | Phoenix/Arize, OpenTelemetry, Pino structured logging | Distributed tracing across polyglot services |
| **Deterministic Backend** | Python 3.12+, FastAPI, Pydantic v2 | CPU-bound validation with rigorous type safety |
| **Data Systems** | PostgreSQL 16, asyncpg, SQLAlchemy 2.0, Alembic | ACID persistence with vector search extension |
| **Analytics** | PostgreSQL aggregates | Time-series aggregations for decision metrics |
| **Search / RAG** | Elasticsearch 8 (BM25), pgvector (dense), cross-encoder reranking | Three-stage hybrid retrieval for precision |
| **Cache / Queue** | Redis 7, redis.asyncio, Celery, Flower | Async task processing and rate caching |
| **External APIs** | SAM.gov integration (Agent Gateway), DOL WDO (future) | Live federal wage rate ingestion |
| **Graph / Entities** | Neo4j-ready entity model (future), NetworkX in-memory now | Entity resolution and knowledge graph foundation |
| **Document Parsing** | pdfplumber | Deterministic PDF table extraction |
| **Testing** | pytest, pytest-benchmark, pytest-asyncio, playwright, vitest | Multi-layer testing with CI regression |
| **Evaluation** | Custom eval framework, golden set, regression detection, LLM-as-judge | Automated quality assurance before deployment |
| **Deployment** | Docker, Docker Compose, GitHub Actions, Vercel, Render | Containerized multi-service orchestration |

---

## Directory Structure (v3)

```
WCP-Compliance-Agent/
├── README.md                          # Project overview and architecture documentation
├── ARCHITECTURE.md                    # System design with diagrams
├── docker-compose.yml                 # Full stack: Postgres + Redis + ES + Phoenix
├── .github/workflows/
│   ├── ci.yml                         # Python + TS + React tests
│   ├── eval.yml                       # Golden set regression detection
│   └── deploy.yml                     # Multi-service deploy
│
├── shared/                            # Contracts + codegen
│   ├── schemas/
│   │   ├── extracted-wcp.json
│   │   ├── deterministic-report.json
│   │   ├── llm-verdict.json
│   │   ├── trust-scored-decision.json
│   │   └── audit-event.json
│   └── generate.py                    # JSON Schema → Pydantic + Zod + TS types
│
├── backend/                           # PYTHON — Deterministic Brain
│   ├── pyproject.toml                 # Poetry, Python 3.12
│   ├── pytest.ini
│   ├── alembic.ini                    # Database migrations
│   ├── celeryconfig.py                # Celery + Redis broker
│   ├── src/
│   │   └── wcp_backend/
│   │       ├── __init__.py
│   │       ├── main.py                # FastAPI app factory
│   │       ├── config.py              # Pydantic Settings (env validation)
│   │       ├── api/
│   │       │   ├── router.py          # Main router aggregator
│   │       │   ├── extract.py         # POST /extract — Layer 1 entry
│   │       │   │                    #   • Text extraction from WH-347
│   │       │   │                    #   • PDF/CSV parsing via pdfplumber
│   │       │   ├── validate.py        # POST /validate — rule engine
│   │       │   │                    #   • Deterministic checks
│   │       │   │                    #   • DBWD rate validation
│   │       │   │                    #   • Overtime calculations
│   │       │   ├── dbwd.py            # GET /dbwd/{trade}/{locality}/{date}
│   │       │   │                    #   • Live DBWD rate lookup
│   │       │   │                    #   • Cache via Redis
│   │       │   ├── decisions.py       # GET/POST /decisions
│   │       │   │                    #   • Audit persistence
│   │       │   │                    #   • Time-series analytics queries
│   │       │   ├── jobs.py            # POST /jobs, GET /jobs/{id}
│   │       │   │                    #   • Celery-backed async processing
│   │       │   │                    #   • Job status + result polling
│   │       │   ├── search.py          # POST /search — hybrid RAG
│   │       │   │                    #   • BM25 + vector + reranking
│   │       │   │                    #   • Metadata filtering
│   │       │   ├── health.py          # GET /health
│   │       │   └── analytics.py       # GET /analytics
│   │       │                        #   • Decision volume trends (PostgreSQL aggregates)
│   │       │                        #   • Approval rate by trade
│   │       │                        #   • Cost per decision
│   │       ├── pipeline/
│   │       │   ├── extraction.py      # WH-347 text → structured JSON
│   │       │   ├── rules.py           # Rule engine: wage, overtime, fringe
│   │       │   ├── dbwd_lookup.py     # DBWD rate retrieval + versioning
│   │       │   └── checks.py          # Individual check implementations
│   │       │       ├── wage_check.py
│   │       │       ├── overtime_check.py
│   │       │       ├── fringe_check.py
│   │       │       ├── signature_check.py
│   │       │       └── total_check.py
│   │       ├── services/
│   │       │   ├── db.py              # asyncpg connection pool
│   │       │   ├── redis_cache.py     # redis.asyncio wrapper
│   │       │   ├── audit.py           # Audit persistence (decisions + events)
│   │       │   ├── job_queue.py       # Celery task definitions
│   │       │   ├── elasticsearch.py   # ES client + BM25 queries
│   │       │   └── phoenix.py         # Arize Phoenix tracer
│   │       ├── retrieval/
│   │       │   ├── hybrid.py          # Orchestrator: BM25 → vector → rerank
│   │       │   ├── bm25.py            # ES BM25 candidate generation
│   │       │   ├── vector.py          # pgvector cosine similarity
│   │       │   ├── cross_encoder.py   # sentence-transformers reranking
│   │       │   └── chunking.py        # Domain-aware chunking (trade×locality)
│   │       ├── models/
│   │       │   ├── schemas.py         # Pydantic models (from JSON Schema)
│   │       │   ├── enums.py           # Status enums, bands
│   │       │   └── graph.py           # Entity relationship model
│   │       │       # WCP → Employee → Check → Verdict → TrustScore
│   │       │       # Graph-ready: maps directly to Neo4j (future) or NetworkX (now)
│   │       ├── workers/
│   │       │   └── celery_worker.py   # Celery worker entrypoint
│   │       └── observability/
│   │           ├── phoenix_setup.py   # Phoenix tracer initialization
│   │           ├── tracing.py         # OpenTelemetry spans
│   │           └── metrics.py         # Custom metrics (latency, tokens)
│   ├── migrations/                      # Alembic migrations
│   │   ├── 001_create_audit_tables.py
│   │   ├── 002_add_pgvector.py
│   │   ├── 003_create_job_queue.py
│   │   └── 004_add_analytics_indexes.py  # Indexes for time-series queries
│   ├── tests/
│   │   ├── unit/                        # 200+ tests: extraction, rules, checks
│   │   ├── integration/                 # FastAPI TestClient for all endpoints
│   │   ├── eval/                        # 100-example golden set
│   │   │   ├── golden_set.json
│   │   │   ├── run_eval.py              # pytest-benchmark evaluation runner
│   │   │   └── regression_test.py       # CI hard-fail on drift
│   │   └── conftest.py                  # Shared fixtures, test DB, mock ES
│   ├── scripts/
│   │   ├── seed_dbwd.py                 # Seed DBWD rates into Postgres
│   │   ├── seed_elasticsearch.py        # Index DBWD chunks into ES
│   │   ├── seed_vectors.py              # Generate embeddings for pgvector
│   │   └── etl_sam_gov.py               # SAM.gov ETL pipeline (activates live rates)
│   └── Dockerfile
│
├── agent/                             # TYPESCRIPT — Integration Layer + Agent Orchestration
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── server.ts                  # Hono app factory
│   │   ├── config.ts                  # Env validation (Zod)
│   │   ├── middleware/                # Integration middleware
│   │   │   ├── auth.ts                # JWT validation, API key auth
│   │   │   ├── rate_limiter.ts        # Request rate limiting per client
│   │   │   ├── validation.ts          # Zod request validation
│   │   │   └── cors.ts                # CORS configuration
│   │   ├── api/                       # External + internal API routes
│   │   │   ├── analyze.ts             # POST /api/analyze — gateway endpoint
│   │   │   ├── analyze-pdf.ts         # POST /api/analyze-pdf — multipart upload
│   │   │   ├── analyze-csv.ts         # POST /api/analyze-csv — bulk upload
│   │   │   ├── health.ts              # GET /health
│   │   │   ├── decisions.ts           # GET /api/decisions
│   │   │   └── jobs.ts                # POST/GET /api/jobs
│   │   ├── integrations/              # External API integrations
│   │   │   ├── sam_gov.ts             # SAM.gov API client (live DBWD rates)
│   │   │   └── dol_wdo.ts             # DOL Wage Determinations Online (future)
│   │   ├── mastra/
│   │   │   ├── agents/
│   │   │   │   └── wcp-verdict.ts     # Layer 2: LLM verdict agent
│   │   │   │                        #   • Structured output via Mastra
│   │   │   │                        #   • Tool-use: extract, validate, dbwd_lookup
│   │   │   ├── tools/
│   │   │   │   ├── extract.ts         # Calls Python /extract
│   │   │   │   ├── validate.ts        # Calls Python /validate
│   │   │   │   ├── dbwd_lookup.ts     # Calls Python /dbwd/{trade}/{locality}
│   │   │   │   ├── search.ts          # Calls Python /search (RAG context)
│   │   │   │   ├── persist.ts         # Calls Python /decisions
│   │   │   │   └── job_status.ts      # Calls Python /jobs/{id}
│   │   │   ├── workflows/
│   │   │   │   └── wcp-pipeline.ts    # Three-layer orchestration
│   │   │   │                        #   • Step 1: extract (Python)
│   │   │   │                        #   • Step 2: validate (Python) → checks
│   │   │   │                        #   • Step 3: verdict (Mastra LLM)
│   │   │   │                        #   • Step 4: trust score (TS)
│   │   │   │                        #   • Step 5: persist (Python)
│   │   │   └── memory/
│   │   │       └── conversation.ts    # (Future) Conversation memory for multi-turn
│   │   ├── prompts/
│   │   │   ├── registry.ts            # Versioned prompt registry
│   │   │   ├── versions/
│   │   │   │   ├── wcp-verdict-v1.ts
│   │   │   │   └── wcp-verdict-v2.ts
│   │   │   └── evaluation/
│   │   │       ├── rubric.ts          # Scoring rubric for evals
│   │   │       └── judge.ts           # LLM-as-judge for prompt quality
│   │   ├── langfuse/
│   │   │   ├── client.ts              # Langfuse integration
│   │   │   ├── tracing.ts             # Trace generation, versioning
│   │   │   └── cost_tracking.ts       # Per-decision cost aggregation
│   │   ├── types/
│   │   │   └── index.ts               # Zod schemas (from JSON Schema)
│   │   ├── utils/
│   │   │   ├── logger.ts              # Pino structured logging
│   │   │   ├── errors.ts              # Custom error hierarchy
│   │   │   ├── http-client.ts         # Typed fetch for Python API
│   │   │   └── rate_limiter.ts        # In-memory rate limiting (A6)
│   │   └── tests/
│   │       ├── unit/
│   │       │   ├── tools.test.ts
│   │       │   ├── prompts.test.ts
│   │       │   └── rate_limiter.test.ts
│   │       └── integration/
│   │           ├── pipeline.test.ts
│   │           └── mock-python.ts     # Mock Python API for CI
│   └── Dockerfile
│
├── frontend/                          # REACT — Product UI
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Layout.tsx
│   │   │   ├── PipelineVisualizer.tsx
│   │   │   ├── UploadDropzone.tsx     # Drag-drop PDF/CSV with progress
│   │   │   ├── DecisionCard.tsx       # Full decision display
│   │   │   ├── AuditTrail.tsx         # Regulation citations, trace ID
│   │   │   ├── EmployeeAccordion.tsx  # Multi-employee display (I5)
│   │   │   ├── TrustScoreBadge.tsx    # Color-coded trust band
│   │   │   ├── HumanReviewQueue.tsx   # Score < 0.60 queue
│   │   │   ├── CostDashboard.tsx      # Per-decision token cost
│   │   │   └── SettingsPanel.tsx      # Prompt version selector, model picker
│   │   ├── hooks/
│   │   │   ├── useAnalyze.ts        # TanStack Query mutation
│   │   │   ├── useJobPolling.ts     # Polling for async jobs
│   │   │   ├── useDecisions.ts      # Paginated decision history
│   │   │   ├── useDecisionStream.ts # SSE for real-time updates
│   │   │   └── usePromptVersions.ts # Langfuse prompt list
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx        # Decision volume + approval rate
│   │   │   ├── Analyze.tsx          # Upload + analyze flow
│   │   │   ├── Decisions.tsx        # Searchable history
│   │   │   ├── ReviewQueue.tsx      # Human review interface
│   │   │   ├── Analytics.tsx        # Cost trends, token usage
│   │   │   └── Settings.tsx         # Prompt version, model config
│   │   ├── types/
│   │   │   └── api.ts               # Shared TS types
│   │   └── utils/
│   │       └── api-client.ts
│   └── Dockerfile
│
└── docs/
    ├── architecture/
    │   ├── architecture.md            # System design with diagrams
    │   ├── system-diagram.png
    │   ├── data-flow.md
    │   └── graph-model.md             # Future Neo4j entity design
    ├── compliance/
    │   ├── regulatory-compliance-report.md
    │   └── traceability-matrix.md
    └── adrs/
        ├── ADR-001-three-services.md
        ├── ADR-002-mastra-ai.md
        ├── ADR-003-phoenix.md
        ├── ADR-004-langfuse.md
        ├── ADR-005-hybrid-rag.md
        ├── ADR-006-celery.md
        ├── ADR-007-pgvector.md
        ├── ADR-008-redis-asyncio.md
        └── ADR-009-excluded-technologies.md
```

---

## Full Data Flow

```
User uploads WH-347 PDF (or types text)
        │
        ▼
┌───────────────────────────────┐
│  React Frontend               │
│  • UploadDropzone shows progress
│  • Routes to /api/analyze-pdf  │
└───────────┬───────────────────┘
            │ multipart/form-data
            ▼
┌───────────────────────────────┐
│  Agent (Hono)                 │
│  • Receives file + metadata
│  • Rate limiting check          │
│  • Content-Length validation    │
└───────────┬───────────────────┘
            │
            ├──► POST backend/extract (Python)
            │    pdfplumber → ExtractedWCP JSON
            │    Returns structured data
            │
            ▼
┌───────────────────────────────┐
│  Mastra Agent (Layer 2)       │
│  • Receives ExtractedWCP
│  • Tool-use: validate (Python)
│    └── POST backend/validate
│        Rules engine → DeterministicReport
│  • LLM reasoning over findings
│  • Tool-use: dbwd_lookup (Python)
│    └── GET backend/dbwd/{trade}
│  • Tool-use: search (Python RAG)
│    └── POST backend/search
│        Hybrid retrieval → context
│  • Structured output: LLMVerdict
│  • Langfuse trace captured
│  • Cost tracked per decision
└───────────┬───────────────────┘
            │
            ▼
┌───────────────────────────────┐
│  Agent (Layer 3)                │
│  • Trust score calculation      │
│  • Score < 0.60 → human review  │
│  • Persist via Python           │
│    └── POST backend/decisions   │
│  • Phoenix span: full trace     │
└───────────┬───────────────────┘
            │ SSE or polling
            ▼
┌───────────────────────────────┐
│  React Frontend                 │
│  • DecisionCard with accordion
│  • Regulation citations (clickable)
│  • TrustScoreBadge (color band)
│  • AuditTrail with trace ID
│  • Cost per decision displayed  │
└───────────────────────────────┘
```

---

## Observability Stack

| Tool | Purpose | Job Description Match |
|---|---|---|
| **Phoenix / Arize** | LLM tracing, prompt evaluation, drift detection | "Integrate observability into AI workflows (e.g., Phoenix)" |
| **Langfuse** | Prompt versioning, A/B testing, cost tracking, per-account config | "Prompt infrastructure including versioning, A/B testing, per-account configuration, and cost tracking" |
| **OpenTelemetry** | Distributed tracing across Python + TS services | OTel standard |
| **Pino (TS) + structlog (Python)** | Structured logging, JSON output | Production logging |
| **Prometheus + Grafana** | Metrics dashboard (future, Phase 2) | Metrics + monitoring |
| **Celery + Flower** | Task queue monitoring | Async job observability |

### Phoenix Integration

- **Python backend:** `arize-phoenix` tracer around FastAPI endpoints
- **TypeScript agent:** `phoenix-client` for LLM call tracing
- **Frontend:** Trace ID display, link to Phoenix UI
- **What it shows:** Latency per layer, token usage per call, prompt version effectiveness

### Langfuse Integration

- **Prompt versioning:** Every prompt change gets a version hash
- **A/B testing:** Route 50% traffic to v1, 50% to v2, compare trust scores
- **Cost tracking:** Aggregate per model, per prompt version, per day
- **Per-account config:** (Future) Different prompts for different contractor tiers

---

## Evaluation & CI

### Golden Set (100 Examples)

```python
# backend/tests/eval/golden_set.json
[
  {
    "id": "eval_001",
    "input": "Role: Electrician, Hours: 40, Wage: 51.69, Fringe: 34.63",
    "expected_status": "Approved",
    "expected_checks": ["wage_check_001", "fringe_check_001"],
    "minimum_trust_score": 0.85,
    "regulations": ["40 U.S.C. § 3142"]
  },
  ...
]
```

### CI Pipeline

```yaml
# .github/workflows/eval.yml
jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - name: Start services
        run: docker-compose up -d postgres redis elasticsearch
      
      - name: Run golden set
        run: cd backend && pytest tests/eval/ --benchmark-only
      
      - name: Regression check
        run: cd backend && python tests/eval/regression_test.py
        # Compares current scores against baseline
        # Fails if trust score drops > 0.05 on any example
      
      - name: Upload eval artifact
        uses: actions/upload-artifact@v4
        with:
          name: eval-results
          path: backend/eval_report.json
```

### LLM-as-Judge

```typescript
// agent/src/prompts/evaluation/judge.ts
// Secondary LLM evaluates verdict quality
// Scores: accuracy (0-10), citation_completeness (0-10), reasoning_clarity (0-10)
// Used for prompt A/B testing via Langfuse
```

---

## Docker Compose (Full Stack)

```yaml
services:
  # ─── Data Layer ─────────────────────────────────────
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: wcp
      POSTGRES_USER: wcp
      POSTGRES_PASSWORD: wcp
    ports: ["5432:5432"]
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/migrations:/docker-entrypoint-initdb.d

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  elasticsearch:
    image: elasticsearch:8.15.0
    environment:
      discovery.type: single-node
      xpack.security.enabled: "false"
    ports: ["9200:9200"]
    volumes:
      - es_data:/usr/share/elasticsearch/data

  # ─── Observability ──────────────────────────────────
  phoenix:
    image: arizephoenix/phoenix:latest
    ports: ["6006:6006"]
    environment:
      PHOENIX_PORT: 6006
    volumes:
      - phoenix_data:/mnt/data

  # ─── Backend (Python) ───────────────────────────────
  backend:
    build: ./backend
    ports: ["8000:8000"]
    environment:
      DATABASE_URL: postgresql+asyncpg://wcp:wcp@postgres:5432/wcp
      REDIS_URL: redis://redis:6379
      ELASTICSEARCH_URL: http://elasticsearch:9200
      PHOENIX_COLLECTOR_ENDPOINT: http://phoenix:6006
      CELERY_BROKER_URL: redis://redis:6379/0
    depends_on: [postgres, redis, elasticsearch, phoenix]

  celery_worker:
    build: ./backend
    command: celery -A wcp_backend.workers worker --loglevel=info
    environment:
      DATABASE_URL: postgresql+asyncpg://wcp:wcp@postgres:5432/wcp
      REDIS_URL: redis://redis:6379
      CELERY_BROKER_URL: redis://redis:6379/0
    depends_on: [postgres, redis]

  celery_beat:
    build: ./backend
    command: celery -A wcp_backend.workers beat --loglevel=info
    environment:
      CELERY_BROKER_URL: redis://redis:6379/0
    depends_on: [redis]

  flower:
    build: ./backend
    command: celery -A wcp_backend.workers flower --port=5555
    ports: ["5555:5555"]
    depends_on: [redis]

  # ─── Agent (TypeScript) ─────────────────────────────
  agent:
    build: ./agent
    ports: ["3000:3000"]
    environment:
      BACKEND_URL: http://backend:8000
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      OPENAI_MODEL: ${OPENAI_MODEL:-gpt-4o-mini}
      LANGFUSE_PUBLIC_KEY: ${LANGFUSE_PUBLIC_KEY}
      LANGFUSE_SECRET_KEY: ${LANGFUSE_SECRET_KEY}
      LANGFUSE_HOST: ${LANGFUSE_HOST:-https://cloud.langfuse.com}
      PHOENIX_COLLECTOR_ENDPOINT: http://phoenix:6006
    depends_on: [backend]

  # ─── Frontend (React) ───────────────────────────────
  frontend:
    build: ./frontend
    ports: ["5173:5173"]
    environment:
      VITE_API_URL: http://agent:3000
      VITE_PHOENIX_URL: http://localhost:6006
    depends_on: [agent]

volumes:
  postgres_data:
  es_data:
  phoenix_data:
```

---

## Migration Phases (Updated)

### Phase 1: Python Backend + Data Layer (Days 1-3)
1. Create `backend/` directory with Poetry setup
2. Port deterministic extraction from `_archive/src/pipeline/layer1-deterministic.ts` → `extractWCPData()` into `backend/src/wcp_backend/pipeline/extraction.py`
3. Port rule engine (8 checks) from `_archive/src/pipeline/layer1-deterministic.ts` into `backend/src/wcp_backend/pipeline/checks/` — see **Archive Reference** section below
4. Add asyncpg + SQLAlchemy 2.0 + Alembic
5. Add Redis caching via redis.asyncio
6. Add Elasticsearch BM25 wrapper
7. Add pgvector dense retrieval
8. Add Phoenix tracing
9. Add Celery + Redis job queue
10. **pytest suite: 200+ tests**

### Phase 2: Observability + Prompt Infra (Days 3-4)
1. Phoenix UI running on :6006
2. Langfuse integration for prompt versioning
3. Cost tracking per decision
4. A/B testing scaffold (50/50 routing)
5. Evaluation pipeline: golden set + regression detection

### Phase 3: Agent Refactor (Days 4-6)
1. Restructure → `agent/src/`
2. Integrate Mastra.ai v0.x
3. Layer 2 as Mastra agent — start from `_archive/src/prompts/versions/wcp-verdict-v2.ts` (production-validated prompt, do not rewrite from scratch)
4. Port LLM integration pattern from `_archive/src/pipeline/layer2-llm-verdict.ts` — note the constraint: LLM must reference Layer 1 check IDs, never recompute findings
5. Python services as Mastra tools
6. Langfuse prompt registry
7. HTTP client for Python API

### Phase 4: React Frontend (Days 6-8)
1. Create `frontend/` with Vite + React 19 + Tailwind + Shadcn
2. Upload → analyze → display flow
3. Multi-employee accordion
4. Cost dashboard
5. Human review queue UI
6. Real-time SSE updates
7. Prompt version selector in settings

### Phase 5: Integration + The Demo (Days 8-10)
1. Docker Compose full stack running
2. E2E: upload PDF → full decision → Phoenix trace → audit trail
3. CI: Python tests + TS build + React build + eval regression
4. README rewrite for product positioning and clarity
5. Architecture ADRs (why three layers, why Python/TS split, etc.)
6. Deploy: Vercel (frontend) + Render (backend + agent)

---

## Archive Reference Guide

The `_archive/` folder contains the V2 TypeScript monolith — a **working proof-of-concept** with all three pipeline layers implemented and tested. Do not copy files from `_archive/` directly; port the logic to Python/new-TypeScript as described below.

### Phase 1 — What to Port to Python Backend

**Field extraction patterns**
- `_archive/src/pipeline/layer1-deterministic.ts` → `extractWCPData()`
- Contains: ~20 regex patterns for role, hours, wage, fringe, per-day hours, gross pay, deductions, net wages, week ending, project ID
- Destination: `backend/src/wcp_backend/pipeline/extraction.py`

**8 Compliance checks (port logic, rewrite in Python)**

| Check | Archive function | V3 file | Regulation |
|---|---|---|---|
| Prevailing wage | `checkPrevailingWage()` | `pipeline/checks/wage_check.py` | 40 U.S.C. § 3142 |
| Overtime | `checkOvertimeCompliance()` | `pipeline/checks/overtime_check.py` | 29 C.F.R. § 5.32 |
| Fringe benefits | `checkFringeBenefits()` | `pipeline/checks/fringe_check.py` | 40 U.S.C. § 3141(2)(B) |
| Signature / certification | `checkSignature()` | `pipeline/checks/signature_check.py` | 29 C.F.R. § 5.5(a)(3)(ii)(B) |
| Arithmetic totals | `checkTotalHours()` | `pipeline/checks/total_check.py` | 29 C.F.R. § 5.5(a)(3)(i) |
| Classification | `resolveClassification()` | `pipeline/extraction.py` | 29 C.F.R. § 5.5(a)(3)(i) |
| Data integrity | `checkDataIntegrity()` | `pipeline/rules.py` | 29 C.F.R. § 5.5(a)(3)(ii) |
| Minimum wage sanity | `checkMinimumWageSanity()` | `pipeline/rules.py` | 29 U.S.C. § 206(a)(1) |

**Trust score formula — port these weights exactly, they are calibrated**
- `_archive/src/pipeline/layer3-trust-score.ts` → `computeTrustComponents()`
- Weights: `deterministic=0.35`, `classification=0.25`, `llm_self=0.20`, `agreement=0.20`
- Bands: `≥0.85` auto, `0.60–0.84` flag for review, `<0.60` require human review
- Agreement scoring: `_archive/src/pipeline/layer3-trust-score.ts` → `computeAgreement()`
  - Critical check failed but LLM says Approved → `agreement=0.0` (major disagreement)
  - All checks pass and LLM says Approved → `agreement=1.0`
  - Adjacent verdict (Reject vs Revise) → `agreement=0.5`
- Destination: `backend/src/wcp_backend/pipeline/rules.py`

**In-memory DBWD corpus (development fallback)**
- `_archive/data/dbwd-corpus.json` — 20 trades with base + fringe rates
- `_archive/src/retrieval/hybrid-retriever.ts` → `IN_MEMORY_ALIASES` — 40+ trade alias variants (e.g. "Electrician", "ELEC", "electrical worker" all map to the same DBWD rate)
- `_archive/src/services/dbwd-retrieval.ts` → `levenshtein()` — edit distance fuzzy matching for unknown trades
- Destination: bundle into `backend/src/wcp_backend/services/redis_cache.py` as cold-start fallback

**Type contracts**
- `_archive/src/types/decision-pipeline.ts` — complete Zod schemas for `ExtractedWCP`, `DeterministicReport`, `LLMVerdict`, `TrustScoredDecision`, `CheckResult`
- Use these to verify V3 Pydantic models in `backend/src/wcp_backend/models/schemas.py` are field-complete

### Phase 3 — What to Port to Agent

**Prompt template (do not rewrite — this is calibrated)**
- `_archive/src/prompts/versions/wcp-verdict-v2.ts`
- Key constraint in the prompt: LLM must reference specific Layer 1 check IDs via `referencedCheckIds` — this is how the audit trail connects LLM reasoning to deterministic findings
- Destination: `agent/src/prompts/versions/wcp-verdict-v2.ts`

**LLM integration constraints**
- `_archive/src/pipeline/layer2-llm-verdict.ts` — the LLM is explicitly forbidden from recomputing findings; it only reasons over what Layer 1 found
- Output validated against Zod schema before acceptance; fallback text extraction if JSON parsing fails
- Destination: `agent/src/mastra/agents/wcp-verdict.ts`

**Mock mode**
- `_archive/src/utils/mock-responses.ts` + `isMockMode()` — triggered when `OPENAI_API_KEY=mock`
- Useful for frontend dev and CI without OpenAI spend
- Destination: configure in `agent/src/config.ts`

### What NOT to Port

| Archive path | Reason |
|---|---|
| `_archive/src/retrieval/` | ES/pgvector code was stubbed and never connected; V3 rebuilds retrieval in Python from scratch |
| `_archive/src/ingestion/pdf-ingestion.ts` | Uses `pdf-parse` (buggy on complex WH-347 tables); V3 uses Python `pdfplumber` |
| `_archive/src/services/job-queue.ts` | In-memory only, lost on restart; V3 uses Celery + Redis |
| `_archive/api/` | Vercel serverless functions; V3 is containerized |
| `_archive/src/app.ts` | V2 monolith router with all routes in one file; V3 splits across `backend/main.py` and `agent/server.ts` |
| `_archive/src/services/human-review-queue.ts` | JSON file persistence; V3 uses PostgreSQL `decisions` table with `requires_human_review` flag |

---

## ADR Checklist

| ADR | Topic | Purpose |
|---|---|---|
| **ADR-001** | Why Three Layers | Decision architecture: deterministic → LLM → trust |
| **ADR-002** | Python + TypeScript Split | Why separate deterministic brain from agent orchestration |
| **ADR-003** | Mastra Over Custom Orchestrator | Why Mastra.ai instead of hand-rolled agent framework |
| **ADR-004** | Phoenix Observability | Why Phoenix/Arize for LLM tracing |
| **ADR-005** | Langfuse Prompt Infra | Why Langfuse for versioning, A/B, cost tracking |
| **ADR-006** | Hybrid RAG Architecture | Why BM25 + vector + cross-encoder |
| **ADR-007** | PostgreSQL + pgvector | Why one DB for relational + vector |
| **ADR-008** | Celery + Redis Queue | Why not in-memory jobs for production |
| **ADR-009** | React Over SvelteKit | Why React 19 for the frontend |

---

## V3.1 Roadmap: Multi-LLM Routing

V3 uses OpenAI exclusively. V3.1 adds model-agnostic routing to demonstrate production-grade LLM infrastructure skills.

### What V3.1 Adds

| Feature | Tech | Purpose |
|---|---|---|
| **Multi-provider support** | Mastra multi-provider + Anthropic | Failover and provider diversity |
| **Local LLM serving** | Ollama (`llama3.2`, `mistral`) | Zero-cost local development + model serving knowledge |
| **LLM routing middleware** | Custom router in Agent Gateway | Cost/quality-based selection, fallback chains |

### Routing Logic

```
Request arrives
  │
  ├── Cost mode? → Ollama (free, local)
  ├── Compliance-critical? → GPT-4o (highest accuracy)
  ├── Synthesis/drafting? → Claude Sonnet (cost/quality balance)
  └── Fallback: GPT-4o → Claude → Ollama
```

### Why This Matters

> "My LLM layer is model-agnostic. I have routing logic that selects provider based on cost threshold, task criticality, and availability. GPT-4o for compliance-critical decisions, Claude for synthesis, Ollama for local development. Provider failure triggers automatic fallback."

### Files Added

- `agent/src/lib/llm-router.ts` — routing logic
- `agent/src/lib/provider-config.ts` — provider configurations
- Modified: `agent/src/mastra/agents/wcp-verdict.ts` — use router

---

## V4 Roadmap: Data Platform (Extension of V3)

**Important:** V4 is **not a rewrite** like V3 was of V2. V4 extends V3's architecture with new capabilities. All V3 services, endpoints, and workflows remain unchanged and operational.

**V3 scope:** Multi-document uploads (batch of 10-100 WCPs) with async processing. Suitable for contractor-level workloads: weekly payroll processing, monthly reporting, demo-scale databases.

**V4 scope:** Enterprise-scale **on top of V3** — thousands of contracts, millions of historical payroll records, continuous bulk ingestion, middleware connecting to external enterprise systems (ERP, HR platforms).

**V3 features that continue unchanged:**
- Multi-document upload and async batch processing (`/api/analyze-pdf` with multiple files)
- Hybrid RAG for DBWD rate lookup
- Deterministic validation and trust scoring
- Golden set evaluation and CI regression
- Celery job queue for background processing

**V4 adds (does not replace):**
- **Scale:** Database partitioning for millions of records (vs. thousands in V3)
- **Persistence:** Contract and payroll tables with full CRUD (vs. transient job processing in V3)
- **Historical:** Multi-year payroll database with search (vs. current batch only in V3)
- **Connectors:** Middleware for external ERP/HR system integration
- **Analytics:** Cross-contract OLAP analytics with DuckDB
- **New pages:** `/contracts`, `/payrolls`, `/ingestion` for enterprise data management

### What V4 Adds

| Layer | Technology | Purpose |
|---|---|---|
| **Database Scale** | PostgreSQL 16 + partitioning | Millions of payroll records, partitioned by contract_id + date |
| **Contract/Payroll Storage** | PostgreSQL + SQLAlchemy 2.0 | Full CRUD for contracts, bulk payroll import, historical search |
| **Analytics Engine** | DuckDB | In-process OLAP over millions of decisions. Reads live PostgreSQL + Parquet archives |
| **Data Format** | Apache Parquet | Columnar storage for decision archives at scale |
| **Pipeline Orchestration** | Prefect | Bulk contract/payroll ingestion, DBWD refresh, data quality checks |
| **Event Streaming** | Redis Streams | Real-time decision events across thousands of contracts |
| **Data Quality** | Great Expectations | Validation as code for bulk ingestion |
| **Enterprise Connectors** | Connector framework | SFTP, API clients, direct DB connections to ERP/HR systems (V4.1) |
| **Analytics Dashboard** | Recharts + React | Cross-contract analytics: violation trends, wage compliance by region, cost curves |

### Data Flow

```
Bulk Ingestion (Prefect):
  SFTP drop / CSV upload / API sync
  → Great Expectations validation
  → PostgreSQL (contracts + payrolls)
  → Trigger analysis for new payroll records

Scheduled Pipeline (Prefect):
  SAM.gov → Validation → PostgreSQL DBWD rates → Parquet archive

Real-Time Streaming (Redis Streams):
  Decision events across all contracts
  → Agent Gateway (SSE) → React analytics dashboard

Analytics Queries (DuckDB):
  DuckDB reads millions of decisions from PostgreSQL + Parquet
  → FastAPI /analytics/* endpoints → Recharts cross-contract views
```

See [V4_PLAN.md](V4_PLAN.md) for full V4 architecture specification.

---

## Success Criteria: What "Working" Means for V3

### System Performance Targets

| Metric | Target | Measurement | Why This Matters |
|---|---|---|---|
| **End-to-end decision latency** | P50 < 2s, P95 < 4s, P99 < 5s | Phoenix traces from upload → verdict | Federal compliance decisions can't be slow; 5s is the pain threshold |
| **RAG retrieval latency** | < 200ms for BM25 + vector + rerank | Backend instrumentation | Sub-200ms leaves headroom for LLM call (~1-2s) |
| **PDF extraction latency** | < 500ms for 10-page WCP | pytest-benchmark | Deterministic extraction shouldn't bottleneck |
| **Concurrent processing** | 10 simultaneous uploads, no degradation | Load test with Locust | Contractor weekly batch processing |
| **System availability** | 99.5% uptime (excludes planned maintenance) | Health check endpoint monitoring | Federal compliance systems need reliability |

### AI/LLM Quality Targets

| Metric | Target | How Measured | Business Impact |
|---|---|---|---|
| **Decision accuracy** | ≥ 95% on golden set | `pytest tests/eval/` | 95% = 1 error per 20 decisions; human review catches the rest |
| **Trust score calibration** | Spearman ρ > 0.7 between score and accuracy | Golden set correlation analysis | High trust scores must correlate with correct decisions |
| **Citation coverage** | ≥ 90% of decisions cite relevant regulations | LLM-as-judge + manual audit | Legally defensible decisions require citations |
| **False positive rate** | < 5% (flagged decisions that should be approved) | Golden set confusion matrix | Too many false positives = wasted human review |
| **False negative rate** | < 2% (approved decisions that should be flagged) | Golden set confusion matrix | False negatives = compliance violations |

### Cost Efficiency Targets

| Metric | Target | Measurement | Rationale |
|---|---|---|---|
| **Cost per decision** | $0.05 - $0.15 (GPT-4o-mini to GPT-4o) | Langfuse aggregation | Comparable to manual review cost (~$0.50) at 10× efficiency |
| **Average tokens per decision** | 2,000 - 4,000 tokens | Langfuse tracking | Token efficiency = prompt engineering quality |
| **Cache hit rate (DBWD)** | > 80% for rate lookups | Redis monitoring | SAM.gov API is rate-limited; caching essential |

### Deterministic Validation Targets

| Metric | Target | Verification | Compliance Requirement |
|---|---|---|---|
| **Wage calculation accuracy** | 100% (exact match to DBWD) | Unit tests + golden set | Federal law requires exact compliance |
| **Deterministic extraction coverage** | All wage, hours, fringe fields extracted | Schema validation | LLM shouldn't hallucinate missing data |
| **Rule validation speed** | < 100ms for all 12 checks | pytest-benchmark | Rule engine shouldn't add latency |

### Observability Targets

| Metric | Target | Tool | Purpose |
|---|---|---|---|
| **Trace coverage** | 100% of decisions have full traces | Phoenix | Every decision auditable |
| **Log retention** | 90 days operational, 7 years audit | PostgreSQL + Parquet | Federal audit requirements |
| **Alert response time** | < 5 minutes for P1 issues | PagerDuty (future) | Production incident response |

---

*Plan version: 2026-04-22 v3.0*
*Estimated effort: 8-10 days of focused work*
*Philosophy: Production-ready multi-service architecture for regulated AI compliance*
