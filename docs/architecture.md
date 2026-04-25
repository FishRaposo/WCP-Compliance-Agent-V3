# Architecture Overview

**Three-service AI decision platform for Davis-Bacon Act payroll compliance.**

---

## Design Principles

1. **Separation of Concerns:** Deterministic logic (Python) × Agent orchestration (TypeScript) × UI (React)
2. **Intentional Technology Selection:** Every technology choice serves a specific architectural purpose
3. **Observability First:** Phoenix + Langfuse integrated from day one, not bolted on later
4. **Evaluation as Code:** Golden set + CI regression detection, not manual QA
5. **Polyglot by Design:** Python for ML/infra, TypeScript for agent frameworks

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  REACT 19 FRONTEND (TypeScript)                                              │
│  Vite + Tailwind + Shadcn/ui + TanStack Query                                │
│  Port: 5173                                                                  │
└────────────────────────────┬─────────────────────────────────────────────────┘
                             │ HTTP / REST + SSE
                             │
┌────────────────────────────▼─────────────────────────────────────────────────┐
│  AGENT GATEWAY (Integration Layer)                                            │
│  TypeScript / Hono / Mastra.ai + Vercel AI SDK + Langfuse + Phoenix          │
│  Port: 3000                                                                  │
│                                                                              │
│  Responsibilities:                                                           │
│  - Integration middleware: auth, rate limiting, validation, CORS               │
│  - External API integration: SAM.gov, third-party services                   │
│  - Cross-service orchestration: frontend → backend → LLM → response            │
│  - LLM reasoning: Mastra.ai tool-use + structured output                   │
│  - Prompt versioning (Langfuse) + trace generation (Phoenix)                 │
└──────────────┬─────────────────────────────────────────────────────────────┘
               │ REST (service-to-service)
               │
┌──────────────▼──────────────────────────────────────────────────────────────┐
│  PYTHON BACKEND (FastAPI)                                                     │
│  FastAPI + Pydantic v2 + Celery + Phoenix + asyncpg                          │
│  Port: 8000                                                                  │
│                                                                              │
│  Responsibilities:                                                           │
│  - Deterministic extraction from PDF/text                                    │
│  - Rule-based validation (wage, overtime, fringe, signature)               │
│  - Hybrid RAG: ES BM25 + pgvector + cross-encoder                             │
│  - DBWD rate lookup with Redis cache                                         │
│  - Decision persistence (PostgreSQL)                                       │
│  - Async job processing (Celery)                                            │
│  - Golden set evaluation                                                     │
└──────────────┬─────────────────────────────────────────────────────────────┘
               │
         ┌─────┴──────┐
         │  DATA LAYER │
         ├─────────────┤
         │ PostgreSQL  │  Relational data: decisions, audits, jobs
         │  + pgvector │  Vector search: DBWD embeddings
         ├─────────────┤
         │ Redis 7     │  Cache: DBWD rates, Celery broker
         ├─────────────┤
         │ ES 8        │  BM25: DBWD text search
         └─────────────┘
```

---

## Data Flow

### 1. WCP Analysis (Happy Path)

```
Frontend uploads WH-347 PDF
         │
         ▼
Agent receives multipart upload
         │
         ├──► POST backend/extract (PDF → ExtractedWCP)
         │     pdfplumber parses tables and fields
         │     Returns structured data
         │
         ├──► Mastra agent: tool-use validate
         │     POST backend/validate
         │     Rule engine runs checks (wage, overtime, fringe)
         │     Returns DeterministicReport with check results
         │
         ├──► Mastra agent: tool-use dbwd_lookup
         │     GET backend/dbwd/{trade}/{locality}
         │     Redis cache → DB or SAM.gov API
         │     Returns DBWD rate
         │
         ├──► Mastra LLM synthesizes verdict
         │     Structured output: LLMVerdict
         │     Must cite check IDs and regulations
         │     Langfuse logs prompt version + cost
         │
         ├──► Agent calculates trust score
         │     Formula: weighted combination of check confidence,
         │     LLM classification confidence, LLM self-assessment,
         │     layer agreement
         │     Score → band: auto / flag / human
         │
         └──► POST backend/decisions (persist)
               Returns final TrustScoredDecision
         │
         ▼
Frontend displays:
- DecisionCard with multi-employee accordion
- TrustScoreBadge (color-coded band)
- AuditTrail with trace ID, regulation citations
- Cost per decision (from Langfuse)
```

### 2. Hybrid RAG (DBWD Lookup)

```
Query: "Electrician prevailing wage Boston 2024"
         │
┌────────┴───────────────────────────────────────┐
│ Stage 1: Candidate Generation (parallel)       │
├────────────────────────────────────────────────┤
│ BM25 (Elasticsearch):                          │
│   query: trade="Electrician" AND locality="Boston"│
│   returns: top 50 candidates                   │
├────────────────────────────────────────────────┤
│ Vector (pgvector):                             │
│   embedding = embed("Electrician prevailing wage...")│
│   query: ORDER BY embedding <=> $1 LIMIT 50     │
│   returns: top 50 candidates                   │
└────────┬───────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│ Stage 2: Fusion                              │
│ RRF_score = Σ 1/(k + rank)                   │
│ k = 60 (standard RRF constant)               │
│ Combine BM25 + vector rankings               │
└────────┬─────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│ Stage 3: Reranking                             │
│ Take top 20 from fused list                    │
│ cross-encoder: ms-marco-MiniLM-L-6-v2          │
│ Score each candidate against query               │
│ Return top 10                                    │
└──────────────────────────────────────────────┘
```

---

## Service Responsibilities

### Frontend (React 19)

**Routes:**
- `/` — Dashboard (decision volume, approval rate)
- `/analyze` — Upload + analyze flow
- `/decisions` — Searchable history
- `/review` — Human review queue (trust score < 0.60)
- `/settings` — Prompt version selector, model picker

**State Management:**
- TanStack Query: server state (decisions, jobs, API calls)
- React useState: local UI state (forms, modals)

### Agent (TypeScript / Hono / Mastra)

**Routes:**
- `POST /api/analyze` — Analyze WCP text
- `POST /api/analyze-pdf` — PDF upload
- `POST /api/analyze-csv` — CSV bulk upload
- `GET /api/decisions` — List decisions
- `GET /api/decisions/:id` — Single decision
- `POST /api/jobs` — Submit async job
- `GET /api/jobs/:id` — Job status

**Mastra Components:**
- `agents/wcp-verdict.ts` — Layer 2 LLM agent
- `tools/extract.ts` — Call Python /extract
- `tools/validate.ts` — Call Python /validate
- `tools/dbwd_lookup.ts` — Call Python /dbwd
- `tools/search.ts` — Call Python /search (RAG)
- `tools/persist.ts` — Call Python /decisions
- `workflows/wcp-pipeline.ts` — Orchestrate 5-step flow

### Backend (Python / FastAPI)

**Routers:**
- `POST /extract` — PDF/text → structured ExtractedWCP
- `POST /validate` — Run deterministic checks
- `GET /dbwd/{trade}/{locality}` — DBWD rate lookup
- `POST /search` — Hybrid RAG search
- `POST /decisions` — Persist decision
- `GET /decisions` — List/query decisions
- `POST /jobs` — Enqueue async job
- `GET /jobs/{id}` — Job status + result
- `GET /health` — Health check

**Pipeline:**
- `extraction.py` — WH-347 parsing
- `rules.py` — Rule engine
- `checks/*.py` — Individual check implementations
- `dbwd_lookup.py` — Rate retrieval + versioning

**Retrieval:**
- `hybrid.py` — Orchestrator
- `bm25.py` — ES queries
- `vector.py` — pgvector similarity
- `cross_encoder.py` — reranking

**Services:**
- `db.py` — asyncpg connection pool
- `redis_cache.py` — aioredis wrapper
- `elasticsearch.py` — ES client
- `audit.py` — Decision persistence
- `job_queue.py` — Celery task definitions
- `phoenix.py` — Arize tracer

---

## Data Model

### Core Entities

```
WCP (Weekly Certified Payroll)
├── id: UUID
├── contractor_id: string
├── project_id: string
├── submission_date: datetime
├── employees: Employee[]
│   ├── worker_name
│   ├── social_security_last4
│   ├── trade_code
│   ├── locality_code
│   ├── hours_by_day: DayHours[]
│   └── gross_pay
└── status: submitted | extracted | validated | decided

Decision
├── id: UUID
├── wcp_id: UUID (foreign key)
├── final_status: Approved | Revise | Reject | Pending Human Review
├── trust_score: float (0.0-1.0)
├── trust_band: auto | flag | human
├── deterministic_report: JSON
├── llm_verdict: JSON
├── audit_trail: AuditEvent[]
├── trace_id: string (Phoenix/Langfuse)
└── created_at: datetime

AuditEvent
├── id: UUID
├── decision_id: UUID
├── layer: extraction | validation | verdict | trust | persist
├── event_type: string
├── details: JSON
└── timestamp: datetime
```

### Graph Model (NetworkX)

```
WCPNode (id=wcp_123)
    ├── EMPLOYEE (id=emp_456) ──► CheckNode (id=check_789)
    │                                 └── VERDICT (id=verdict_abc)
    └── EMPLOYEE (id=emp_457) ──► CheckNode (id=check_790)
                                      └── VERDICT (id=verdict_abd)

VerdictNode
    └── TRUST_SCORE (id=trust_xyz, score=0.92)
```

---

## Observability

### Phoenix Tracing

**Spans:**
- `wcp-analysis` (root span across services)
  - `agent-orchestration` (Mastra workflow)
    - `llm-call` (OpenAI generation)
    - `tool-call` (Python backend)
  - `python-backend` (FastAPI request)
    - `extraction` (pdfplumber)
    - `validation` (rule engine)
    - `dbwd-lookup` (cache/DB)
    - `rag-search` (hybrid retrieval)

### Langfuse Tracking

**Prompt Versions:**
- `wcp-verdict-v1`, `v2`, `v3`...
- Metadata: `org_id`, `tier`, `ab_test_group`

**Metrics:**
- Input/output tokens per call
- Cost per decision (aggregated)
- Latency per prompt version
- A/B test conversion rates

---

## Evaluation

### Golden Set

- 100 labeled examples
- Coverage: all 20 trades, edge cases, both outcomes
- Stored: `backend/tests/eval/golden_set.json`

### Regression Detection

CI runs:
1. Golden set → produces `eval_report.json`
2. Compare to `baseline.json`
3. Hard-fail if:
   - Any example drops > 0.05 trust score
   - Overall accuracy drops > 2%
   - P99 latency increases > 50%

### LLM-as-Judge

Secondary LLM scores:
- Accuracy (0-10)
- Citation completeness (0-10)
- Reasoning clarity (0-10)
- Cost efficiency (0-10)

---

## Security & Compliance

- **PII:** Social security numbers truncated to last-4
- **Audit Trail:** Immutable decision records
- **Traceability:** Every check cites specific regulation
- **Retention:** 7-year audit trail (configurable)

---

## Service Independence & Testing Architecture

**Design Principle:** Each service can run standalone with mocked dependencies.

### Independence Tests

| Service | Mock Strategy | Tests Without |
|---|---|---|
| **Frontend** | Mock Agent API responses | React Testing Library + MSW |
| **Agent Gateway** | Mock Python backend (nock/msw) | Hono tests with stubbed HTTP client |
| **Python Backend** | Mock LLM calls (responses library) | pytest with mocked OpenAI |

This ensures:
- Parallel development (frontend dev doesn't need backend running)
- Isolated unit testing (fast, no Docker required)
- Clear contract validation (shared schemas enforce compatibility)

### Python as Deterministic Validation Layer

**All agent scaffolding and validation runs in Python:**
- **PDF/text extraction:** Deterministic parsing via pdfplumber
- **Rule validation:** Wage, overtime, fringe, signature checks
- **Golden set evaluation:** 100-example regression testing in Python
- **LLM-as-judge scoring rubrics:** Validation logic in Python
- **Trust score calculation:** Deterministic algorithm, not LLM-based

**Agent Layer (TypeScript) responsibilities:**
- LLM reasoning via Mastra.ai
- Tool orchestration (calls Python for deterministic work)
- Cross-service coordination
- **No validation logic** — defers to Python backend

**Why this separation:**
- Deterministic validation is testable, auditable, reproducible
- LLM reasoning handles ambiguity, synthesis, natural language
- Clear boundary: Python = "provable correctness", TypeScript = "intelligent reasoning"

### Why Python Owns Deterministic Validation

Federal compliance demands **provable correctness**:

| Validation Type | Python Implementation | Why Not LLM |
|---|---|---|
| **Wage calculation** | `wage * hours` with Decimal precision | LLMs hallucinate math |
| **Overtime rules** | `hours > 40 ? wage * 1.5 : wage` | LLMs inconsistent with regulations |
| **Fringe benefits** | `fringe_rate * hours` exact match | LLMs approximate |
| **Trust scores** | Deterministic algorithm (not ML-based) | Must be reproducible for audit |
| **Golden set evaluation** | pytest with exact assertions | Can't have eval logic vary |

**The boundary:**
- TypeScript Agent: "Here's what the LLM thinks"
- Python Backend: "Here's what the math proves"
- Trust Score: "Here's the confidence based on evidence, not opinion"

This separation means:
- DOL auditor: "Show me the wage calculation" → Python deterministic code
- Legal defense: "The LLM said X" → "The math proves Y, and here's the audit trail"
- Regression testing: "Did we break math?" → pytest with 100% reproducibility

---

## Scaling Considerations

**Current:** Single-node Docker Compose
**Phase 2:**
- Kubernetes deployment
- Horizontal Celery worker scaling
- Read replicas for PostgreSQL
- ES cluster mode
- Neo4j for entity graph (deferred)

---

## Related Documentation

- [ADR-001: Three Services](adrs/ADR-001-three-services.md)
- [ADR-005: Hybrid RAG](adrs/ADR-005-hybrid-rag.md)
- [API Contract](api-contract.md)
- [Evaluation Pipeline](evaluation.md)

---

*Generated: 2026-04-22*
