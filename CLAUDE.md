# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

See [AGENTS.md](AGENTS.md) for all build, test, lint, and dev commands. That file is the authoritative source — don't duplicate it here.

---

## What This Project Is

A three-service AI decision engine that validates WH-347 federal construction payroll submissions against Davis-Bacon Act requirements. Every decision must be legally defensible: regulation citations on every finding, immutable audit trail, deterministic math that produces identical results on every run.

---

## Implementation Status

**All phases complete through V3.1.**

- **Phase 1 (Backend Core):** Python deterministic pipeline. 87 unit tests. 9 API router modules.
- **Phase 2 (Data Layer):** PostgreSQL (pgvector), Redis, Elasticsearch, hybrid RAG, Alembic migrations, seed scripts, Celery, Phoenix.
- **Phase 3 (Agent):** Mastra.ai verdict agent, mock + real LLM, trust scores, Langfuse tracing, JWT auth, 29 agent tests.
- **Phase 4 (Frontend):** React 19 SPA, 7 pages, 12 components, shadcn/ui, TanStack Query, mock data layer.
- **Phase 5 (Eval):** 100-example golden set, E2E integration tests, scheduled eval CI, regression detection.
- **Phase 6 / V3.1 (Multi-LLM):** OpenAI + Anthropic + Ollama routing with fallback chain, 11 router tests, baseline scores.

**Test counts:** 87 backend unit + 40 agent (unit + integration + router) + 100 golden set eval = 227 total.

---

## Three-Layer Pipeline

```
Layer 1 (Python backend)     Layer 2 (Agent/TypeScript)    Layer 3 (Agent/TypeScript)
─────────────────────────    ──────────────────────────    ──────────────────────────
PDF → pdfplumber extract      Mastra agent with tools        Trust score computation
↓                             ↓                              ↓
ExtractedWCP (Pydantic)       LLM call via router            0.35 × deterministic
↓                             (OpenAI/Anthropic/Ollama)      0.25 × classification
Rule engine:                  LLMVerdict (Zod)               0.20 × llm_self_confidence
  wage_check  (§ 3142)       + Langfuse trace               0.20 × agreement
  fringe_check (§ 3141)                                      ─────────────────
  overtime_check (§ 5.32)                                    ≥ 0.85 → auto-approve
  signature_check (§ 5.5)                                    0.60–0.84 → flag
  total_check (arithmetic)                                   < 0.60 → human review queue
↓
DeterministicReport (Pydantic)
```

**Layer 1 critical rule:** `wage_check` or `fringe_check` failure → `deterministic_score = 0.0` regardless of other checks. These are not proportional reductions.

**Agreement scoring:** LLM verdict vs deterministic findings. Critical fail + LLM says Approved = 0.0 agreement. All pass + Approved = 1.0. Mismatched severity (Warning vs Approved) = 0.5.

The trust score weights are calibrated from V2 — do not change them.

---

## Service Boundaries

```
Frontend (5173) → Agent Gateway (3000) → Python Backend (8000)
```

Frontend never calls the Python backend directly. Agent never does deterministic math — it only orchestrates. Backend never makes LLM calls.

DBWD rate lookup (prevailing wage) follows a cache-aside chain: Redis (24h TTL) → PostgreSQL `dbwd_rates` → SAM.gov API → in-memory fallback (`_archive/data/dbwd-corpus.json`, 20 trades, dev only).

---

## Cross-Service Contracts

Schemas live in `shared/schemas/*.json` (JSON Schema). Codegen (`python shared/generate.py`) produces `backend/src/wcp_backend/models/_generated.py` (Pydantic) and `agent/src/types/_generated.ts` (Zod). Hand-written models in each service take precedence.

When modifying a schema: update the JSON Schema first, then run `python shared/generate.py`. The TypeScript agent must validate all data crossing service boundaries with Zod before passing it to the LLM or returning it to the frontend.

---

## Compliance Constraints

- Every `ComplianceCheck` in `DeterministicReport` must include a `regulation_cite` field (e.g., `"40 U.S.C. § 3142"`). This is what makes audit trails legally defensible.
- `decisions` table is INSERT-only. No UPDATE or DELETE — this is an immutable audit trail for DOL review.
- `audit_events` table is append-only.
- `phoenix_trace_id` links every `TrustScoredDecision` to its LLM reasoning trace in Phoenix.
- Decisions with `trust_score < 0.60` must appear in `HumanReviewQueue`. This is not optional.

---

## Hybrid RAG

Three-stage retrieval in `backend/src/wcp_backend/retrieval/`:
1. BM25 via Elasticsearch — top 20 candidates
2. Vector search via pgvector — top 20 candidates (sentence-transformers embeddings, 384-dim)
3. Deduplicate by `chunk_id`, then cross-encoder reranking (`ms-marco-MiniLM-L-6-v2`) → top_k final

Regulation chunks must be seeded before any full pipeline run (`scripts/seed_elasticsearch.py`, `scripts/seed_vectors.py`).

---

## Key Docs

| Topic | File |
|---|---|
| Full architecture spec | `docs/planning/V3_PLAN.md` |
| Porting guide from V2 | `docs/planning/V2_TO_V3_TRANSITION.md` |
| Check → regulation mapping | `docs/compliance/traceability-matrix.md` |
| End-to-end data flow diagrams | `docs/architecture/data-flow.md` |
| Local dev + mock mode | `docs/local-dev.md` |
| ADRs (technology decisions) | `docs/adrs/` |
| Changelog | `CHANGELOG.md` |
