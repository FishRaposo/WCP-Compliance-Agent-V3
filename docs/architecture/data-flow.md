# Data Flow

End-to-end request lifecycle for a WH-347 payroll submission.

---

## Happy Path: Single PDF Upload

```
User uploads WH-347 PDF
        │
        ▼
┌───────────────────────────────────────────────────┐
│  React Frontend (Port 5173)                        │
│  UploadDropzone → POST /api/analyze-pdf            │
│  PipelineVisualizer shows live step progress (SSE) │
└───────────────────────┬───────────────────────────┘
                        │ multipart/form-data
                        ▼
┌───────────────────────────────────────────────────┐
│  Agent Gateway (Port 3000, Hono)                   │
│  • Rate limit check (60 req/min per IP)            │
│  • Content-Length validation (< 10 MB)             │
│  • File forwarded as bytes to Python               │
└──────────────┬──────────────────────┬─────────────┘
               │                      │
               │ POST /extract/pdf     │
               ▼                      │
┌──────────────────────────────┐      │
│  Python Backend (Port 8000)  │      │
│  Layer 1 — Extraction        │      │
│  pdfplumber → text           │      │
│  regex patterns → fields     │      │
│  Returns: ExtractedWCP JSON  │      │
└──────────────┬───────────────┘      │
               │ ExtractedWCP         │
               │                      │
               │ POST /validate        │
               ▼                      │
┌──────────────────────────────┐      │
│  Python Backend              │      │
│  Layer 1 — Rule Engine       │      │
│  ┌─ wage_check (§ 3142)      │      │
│  ├─ overtime_check (§ 5.32)  │      │
│  ├─ fringe_check (§ 3141)    │      │
│  ├─ signature_check (§ 5.5)  │      │
│  ├─ total_check (arithmetic) │      │
│  └─ GET /dbwd/{trade} ────────────► Redis cache │
│     (prevailing wage lookup) │      │  ↓ miss    │
│                              │      │ PostgreSQL  │
│  Returns: DeterministicReport│      │  ↓ miss    │
└──────────────┬───────────────┘      │ SAM.gov API │
               │                      │
               │ DeterministicReport  │
               ▼                      │
┌──────────────────────────────┐      │
│  Agent Gateway               │      │
│  Mastra Agent — Layer 2      │      │
│  • Tool: search (RAG context)│      │
│    └─ POST /search ──────────────► │
│       BM25 (Elasticsearch)   │      │
│       + vector (pgvector)    │      │
│       + cross-encoder rerank │      │
│  • LLM call (GPT-4o-mini)    │      │
│    Prompt: wcp-verdict-v2    │      │
│    Input: DeterministicReport│      │
│           + RAG context      │      │
│    Output: LLMVerdict (JSON) │      │
│  • Langfuse trace logged     │      │
│  • Cost computed (USD)       │      │
└──────────────┬───────────────┘      │
               │ LLMVerdict           │
               ▼                      │
┌──────────────────────────────┐      │
│  Agent Gateway               │      │
│  Layer 3 — Trust Scoring     │      │
│  Score = weighted sum:       │      │
│    0.35 × deterministic      │      │
│    0.25 × classification     │      │
│    0.20 × llm_self           │      │
│    0.20 × agreement          │      │
│  Band:                       │      │
│    ≥ 0.85 → auto (no review) │      │
│    0.60–0.84 → flag          │      │
│    < 0.60 → require review   │      │
└──────────────┬───────────────┘      │
               │ TrustScoredDecision  │
               │                      │
               │ POST /decisions ─────────► PostgreSQL
               │ (audit persistence)  │      decisions table
               │                      │      audit_events table
               │                      │
               │◄─────────────────────┘
               │ TrustScoredDecision
               ▼
┌───────────────────────────────────────────────────┐
│  React Frontend                                    │
│  DecisionCard: verdict + trust band + reasoning   │
│  AuditTrail: regulation citations + trace ID      │
│  TrustScoreBadge: color-coded band                │
│  If requires_human_review → HumanReviewQueue      │
└───────────────────────────────────────────────────┘
```

---

## DBWD Rate Lookup (Cache-Aside)

```
GET /dbwd/{trade}/{locality}/{date}
        │
        ▼
   Redis cache ──► HIT → return cached rate
        │
        MISS
        ▼
   PostgreSQL (dbwd_rates) ──► HIT → cache + return
        │
        MISS
        ▼
   SAM.gov API ──► fetch → validate → upsert PostgreSQL → cache → return
        │
        ERROR (rate limit / network)
        ▼
   In-memory fallback corpus
   (20-trade table from _archive/data/dbwd-corpus.json)
```

Cache TTL: 24 hours. SAM.gov rate limit: ~100 req/day. Redis key format: `dbwd:{trade}:{locality}:{date}`.

---

## Hybrid RAG Retrieval

```
POST /search  { query, trade, locality, top_k }
        │
        ├── BM25 (Elasticsearch DBWD index)
        │       top 20 candidates
        │
        ├── Vector (pgvector cosine similarity)
        │       embed query → sentence-transformers
        │       top 20 candidates
        │
        │   Deduplicate by chunk_id
        │
        └── Cross-encoder reranking (ms-marco-MiniLM-L-6-v2)
                score all candidates against query
                return top_k final results
```

---

## Async Batch Processing (CSV Upload)

```
POST /api/analyze-csv (Agent)
        │
        ▼
   Parse CSV rows (papaparse / pandas equivalent)
        │
        ▼
   POST /jobs (Agent → Python)
   Celery enqueues process_payroll_batch task
        │
        ▼
   Response: { job_id, status: "pending" }
        │
        ▼ (Frontend polls every 2s via useJobPolling)

   Celery Worker
   ├── For each row:
   │       run full pipeline (extract → validate → verdict → trust score)
   │       persist decision
   └── Update job status: pending → processing → complete

   GET /api/jobs/{job_id} (Frontend polls)
        │
        ▼
   { status: "complete", result: TrustScoredDecision[] }
```

Celery dashboard (Flower): `http://localhost:5555`

---

## Request / Response Shapes at Each Boundary

| Boundary | Schema file |
|---|---|
| Frontend → Agent | REST JSON (untyped at network, Zod-validated in agent) |
| Agent → Python `/extract` | `shared/schemas/extracted-wcp.json` |
| Agent → Python `/validate` | `shared/schemas/deterministic-report.json` |
| Agent (LLM output) | `shared/schemas/llm-verdict.json` |
| Agent → Frontend (final) | `shared/schemas/trust-scored-decision.json` |
| Audit trail | `shared/schemas/audit-event.json` |

See [api-contract.md](../api-contract.md) for full endpoint specs.
