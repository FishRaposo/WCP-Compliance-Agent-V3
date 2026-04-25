# Job Coverage Analysis

**Reference appendix mapping V3 architecture to specific job posting requirements.**

This document maps the WCP Compliance Agent v3 to two AI/ML engineering roles that informed its design. For strategic career positioning and transferable skills, see [CAREER_POSITIONING.md](CAREER_POSITIONING.md). For interview talking points, see [INTERVIEW_PREP.md](INTERVIEW_PREP.md).

---

## Coverage Summary

| Job | Requirements | Covered | Coverage |
|---|---|---|---|
| **Job 1: AI Agent Developer** | 9 | 9 | **100%** |
| **Job 2: AI Infrastructure Engineer** | 19 | 18 | **95%** |

**Uncovered (deferred):**
- Neo4j graph database (nice-to-have in Job 2)

---

## Job 1: WCP AI Agent Developer

| Job Requirement | V3 Implementation | Evidence |
|---|---|---|
| **Strong TypeScript** | Integration Layer (Hono + Mastra) + Frontend (React) | `agent/src/` fully TypeScript |
| **Integration middleware** | Auth, rate limiting, validation in Agent Gateway | `agent/src/middleware/` |
| **External API integration** | SAM.gov API client for live DBWD rates | `agent/src/integrations/sam_gov.ts` |
| **Mastra.ai** | Agent orchestration layer | `agent/src/mastra/agents/wcp-verdict.ts` |
| **Cross-service orchestration** | Frontend → Backend → LLM → Response coordination | `agent/src/mastra/workflows/wcp-pipeline.ts` |
| **Document parsing** | pdfplumber in Python backend | `backend/src/pipeline/extraction.py` |
| **Structured/unstructured data** | Pydantic models + PDF extraction + Zod schemas | `shared/schemas/` contracts |
| **Compliance workflows** | Three-layer pipeline: extract → validate → verdict → trust | `backend/src/pipeline/`, `agent/src/mastra/workflows/` |
| **Real-world AI decision engine** | Full WCP review with audit trail | `backend/src/services/audit.py` |

---

## Job 2: AI Infrastructure Engineer

| Job Requirement | V3 Implementation | Evidence |
|---|---|---|
| **5+ years Python production backend** | FastAPI + asyncpg + SQLAlchemy 2.0 + Celery | `backend/src/main.py`, `celeryconfig.py` |
| **RAG pipelines** | Three-stage hybrid retrieval | `backend/src/retrieval/hybrid.py` |
| **Search systems** | Elasticsearch 8 integration | `backend/src/services/elasticsearch.py` |
| **Hybrid search (BM25 + vector + cross-encoder)** | Exact implementation | `backend/src/retrieval/` (bm25.py, vector.py, cross_encoder.py) |
| **Tool-use functions** | Mastra tools calling Python endpoints | `agent/src/mastra/tools/extract.ts`, `validate.ts`, etc. |
| **Elasticsearch** | ES 8 for DBWD corpus search | `docker-compose.yml` service |
| **Redis-cached state** | Redis for DBWD cache + Celery broker | `backend/src/services/redis_cache.py` |
| **Testing infrastructure** | pytest + golden set + CI regression + unit/integration tests | `backend/tests/` |
| **Validation layer** | Python handles all deterministic scaffolding for agents | `backend/src/pipeline/` (extraction, validation, trust score) |
| **Evaluation pipelines, datasets, rubrics** | 100-example golden set + LLM-as-judge | `backend/tests/eval/` |
| **CI-based evaluation** | GitHub Actions eval workflow | `.github/workflows/eval.yml` |
| **Prompt versioning, A/B, per-account, cost tracking** | Langfuse integration | `agent/src/langfuse/` |
| **Phoenix observability** | Phoenix/Arize tracing | `backend/src/observability/phoenix.py` |
| **Entity-based abstractions** | NetworkX graph model | `backend/src/models/graph.py` |
| **Knowledge graphs** | Graph-ready entity model, Neo4j-ready | ADR-001, `graph.py` |
| **SQL-heavy data systems** | PostgreSQL 16 + asyncpg + SQLAlchemy 2.0 | `backend/src/services/db.py` |
| **Embedding models + vector search** | pgvector + text-embedding-3-small | `backend/src/retrieval/vector.py` |
| **Full stack when needed** | React 19 + Vite + Tailwind | `frontend/src/` |
| **Building systems from scratch** | Greenfield three-service architecture | This repo |

---

## See Also

- [CAREER_POSITIONING.md](CAREER_POSITIONING.md) — Strategic narrative and transferable skills
- [INTERVIEW_PREP.md](INTERVIEW_PREP.md) — Pre-prepared interview answers
- [CAREER_POSITIONING.md#architecture-decisions-summary](CAREER_POSITIONING.md#architecture-decisions-summary) — Engineering rationale for technology choices
- [V2_TO_V3_TRANSITION.md](../../V2_TO_V3_TRANSITION.md) — Architectural evolution narrative

---

*Generated: 2026-04-22*
