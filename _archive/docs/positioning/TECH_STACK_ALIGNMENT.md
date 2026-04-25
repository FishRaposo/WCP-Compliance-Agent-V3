# Tech Stack Alignment: WCP → Dual Role Positioning

**Purpose:** Map the WCP Compliance Agent to both job descriptions so a single project reads as proof of work for both.

**Roles covered:**
1. **Upwork — Founding AI Developer** (federal compliance, document parsing, agent frameworks)
2. **Revenue Intelligence — Founding AI Infrastructure Engineer** (RAG, retrieval, evaluation, prompt infra)

---

## Layer 1: TypeScript / Node.js Backend (Both Roles)

| Requirement | WCP Evidence | Where to Point |
|---|---|---|
| **Strong TypeScript** | Pure TS, ESM, strict config | `src/`, `tsconfig.backend.json` |
| **Production backend systems** | Hono API server, PostgreSQL persistence, job queue | `src/app.ts`, `src/services/` |
| **Full-stack when needed** | React frontend (Vite + Tailwind), API layer, DB layer | `src/frontend/`, `src/app.ts` |
| **Build from scratch** | Entire architecture designed from zero — no inherited codebase | README architecture diagram |

> **Gap:** Job 2 asks for Python or Java. Positioning: "TypeScript/Node.js backend with equivalent production patterns — RAG pipelines, search infra, evaluation CI — all patterns are language-agnostic and transfer directly to Python stacks."

---

## Layer 2: AI / LLM Systems (Both Roles)

| Requirement | WCP Evidence | Where to Point |
|---|---|---|
| **LLM-based intelligent agents** | Three-layer decision pipeline with constrained LLM reasoning | `src/pipeline/layer2-llm-verdict.ts` |
| **Mastra.ai or similar** | WCP started with Mastra, then evolved to custom pipeline — shows framework fluency and when to drop abstractions | `CHANGELOG.md`, `docs/adrs/` |
| **LLM APIs, function calling** | Vercel AI SDK + OpenAI GPT-4o-mini with structured output | `src/pipeline/layer2-llm-verdict.ts:68-92` |
| **Real-world AI decision engine** | Deterministic scaffolding → LLM verdict → trust-scored routing | `src/pipeline/orchestrator.ts` |
| **Dynamic, on-demand retrieval** | Prompt context assembled at request time from DBWD corpus — no pre-baked prompts | `src/prompts/resolver.ts`, `src/retrieval/` |

---

## Layer 3: RAG & Search (Role 2 Heavy)

| Requirement | WCP Evidence | Where to Point |
|---|---|---|
| **RAG pipelines** | Full retrieval → generation pipeline: BM25 candidate generation, vector similarity, cross-encoder reranking, then LLM reasoning | `src/retrieval/hybrid-retriever.ts` |
| **Hybrid search (BM25 + vector + reranking)** | Exactly this: Elasticsearch BM25, pgvector dense search, cross-encoder re-ranking | `src/retrieval/bm25-search.ts`, `src/retrieval/vector-search.ts`, `src/retrieval/cross-encoder.ts` |
| **Semantic chunking** | DBWD corpus chunked by trade × locality × wage section — domain-aware chunking | `src/retrieval/hybrid-retriever.ts`, `wcp.config.json` |
| **Elasticsearch** | BM25 implementation with `ELASTICSEARCH_URL` wired | `src/retrieval/bm25-search.ts` |
| **Vector search in production** | pgvector + cosine similarity for dense retrieval | `src/retrieval/vector-search.ts` |
| **Embedding models** | Sentence-transformers pattern (cross-encoder for reranking) | `src/retrieval/cross-encoder.ts` |
| **Search over transcripts** | WCP searches payroll text; same pattern applies to call transcripts | `src/retrieval/hybrid-retriever.ts:resolveContext()` |

> **Gap:** No actual Elasticsearch or pgvector instances running in the demo — both fallback to in-memory. Positioning: "Architecture is fully wired for both; demo runs in-memory for portability. Production deployment would activate the external services with zero code changes."

---

## Layer 4: Data Systems (Role 2 Heavy)

| Requirement | WCP Evidence | Where to Point |
|---|---|---|
| **SQL-heavy data systems** | PostgreSQL with complex schema: decisions, audit_events, jobs, rate determinations | `migrations/001_create_audit_tables.sql`, `src/services/audit-persistence.ts` |
| **Analytics warehouse pattern** | `audit_events` table designed for time-series analytics; `listDecisions()` with limit/pagination | `src/services/audit-persistence.ts` |
| **Redis-cached state** | `src/services/dbwd-retrieval.ts` uses in-memory caching pattern — same pattern as Redis-backed CRM state | `src/services/dbwd-retrieval.ts`, `src/utils/mock-responses.ts` |
| **Entity-based abstractions** | `ExtractedWCP`, `ExtractedEmployee`, `DeterministicReport`, `LLMVerdict`, `TrustScoredDecision` — rich typed entities | `src/types/decision-pipeline.ts` |
| **Cross-call behavioral insights** | Audit trail captures full decision trace per submission — same pattern as per-call analysis | `src/types/decision-pipeline.ts:AuditEvent[]` |
| **Graph-ready entities** | Entity relationships modeled (WCP → employees → checks → verdict → trust score) — could layer graph DB on top | `src/types/decision-pipeline.ts` |

> **Gap:** No Redshift, Salesforce, or actual Redis. Positioning: "PostgreSQL schema and caching patterns are directly transferable. Entity model (Rep/Call/Opportunity/Moment) maps to WCP's (WCP/Employee/Check/Verdict/TrustScore)."

---

## Layer 5: Evaluation & CI (Role 2 Heavy)

| Requirement | WCP Evidence | Where to Point |
|---|---|---|
| **Evaluation pipelines** | 100-example golden set with trust calibration | `tests/eval/`, `wcp.config.json:calibration` |
| **Scoring rubrics** | Trust score bands (auto/manual/review) calibrated against golden set | `src/pipeline/layer3-trust-score.ts`, `wcp.config.json` |
| **Regression detection** | Calibration CI job hard-fails on `main` if scores drift | `.github/workflows/pipeline-discipline.yml` |
| **CI-based evaluation frameworks** | GitHub Actions: test → lint:pipeline → build → calibration | `.github/workflows/pipeline-discipline.yml` |
| **Prompt versioning** | `src/prompts/registry.ts` with versioned prompt keys (`wcp-verdict-v1`, `wcp-verdict-v2`) | `src/prompts/`, `src/prompts/versions/` |
| **A/B testing infrastructure** | `promptVersion` field in every `LLMVerdict` — enables prompt-level A/B comparison in production | `src/types/decision-pipeline.ts:LLMVerdict.promptVersion` |
| **Cost tracking** | Token usage captured per decision in `health.tokenUsage` | `src/types/decision-pipeline.ts` |

---

## Layer 6: Observability & Audit (Both Roles)

| Requirement | WCP Evidence | Where to Point |
|---|---|---|
| **Observability (Phoenix)** | OTel SDK with OTLP exporter; structured pino logging; full audit trail | `src/instrumentation.ts`, `src/utils/logger.ts` |
| **Traceability** | Every decision has `traceId`, every layer emits `AuditEvent[]`, every check cites regulation | `src/types/decision-pipeline.ts`, `docs/compliance/traceability-matrix.md` |
| **Human review queue** | Score < 0.60 auto-routes to `humanReviewQueue` | `src/pipeline/layer3-trust-score.ts`, `src/services/human-review-queue.ts` |

---

## Layer 7: Document Parsing (Role 1 Heavy)

| Requirement | WCP Evidence | Where to Point |
|---|---|---|
| **Document parsing** | PDF ingestion via `pdf-parse`, CSV via `papaparse`, structured text via regex | `src/ingestion/pdf-ingestion.ts`, `src/ingestion/csv-ingestion.ts`, `src/pipeline/layer1-deterministic.ts` |
| **Structured/unstructured data** | WH-347 form extraction (structured) + free-text rationale (unstructured) | `src/pipeline/layer1-deterministic.ts`, `src/pipeline/layer2-llm-verdict.ts` |
| **Compliance workflows** | Davis-Bacon Act prevailing wage validation with regulation citation | `docs/compliance/regulatory-compliance-report.md` |

---

## Unified Narrative (For Both Applications)

### Pitch — Role 1 (Upwork / Compliance)

> "I built a three-layer AI decision engine for federal payroll compliance. Layer 1 extracts structured data from WH-347 forms via deterministic parsing. Layer 2 uses constrained LLM reasoning to generate verdicts that cite specific regulation passages. Layer 3 scores trust and routes low-confidence decisions to human review. The system is fully auditable — every decision has a replayable trace with regulation citations."

### Pitch — Role 2 (Revenue Intelligence / Founding AI Infra)

> "I architected the core AI infrastructure for a compliance decision system that maps directly to revenue intelligence needs. I built a hybrid RAG pipeline (BM25 + pgvector + cross-encoder reranking) for dynamic context assembly. I designed a prompt versioning system with A/B tracking. I implemented CI-based evaluation with a golden set and regression detection. The entity model (WCP → Employee → Check → Verdict → TrustScore) is structured for graph expansion. All observability is OTel-native with structured audit trails."

### Combined (If Asked About Both)

> "My current project is a compliance decision engine, but the architecture is intentionally general — it's the same pattern as revenue intelligence: retrieval layer controls what the LLM sees, prompt infrastructure enables safe experimentation, evaluation CI catches regressions, and entity-based abstractions support graph relationships. I chose compliance as the first domain because it forces rigor — every decision must cite a source and have an audit trail."

---

## Quick Wins to Close Gaps

If you want to make the match even tighter:

| Gap | Quick Fix | Effort |
|---|---|---|
| **No actual ES/pgvector running** | Add a `docker-compose.yml` with ES + Postgres + pgvector | 30 min |
| **No Redis** | Add `ioredis` to job queue, swap in-memory fallback for Redis | 1 hr |
| **No cost dashboard** | Add `GET /api/costs` endpoint aggregating token usage | 1 hr |
| **No graph DB** | Add a `docs/architecture/graph-model.md` showing entity relationships as graph | 30 min |
| **Python mention** | Add a `scripts/` Python alternative for data processing (ETL to ES) | 2 hrs |
| **Phoenix observability** | Wire Phoenix Arize instead of console OTLP | 1 hr |

---

*Document version: 2026-04-22 — aligned against both job descriptions*
