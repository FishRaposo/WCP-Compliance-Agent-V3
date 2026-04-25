# Tech Relevance Audit: Job Descriptions vs WCP

**Date:** 2026-04-22
**Purpose:** Strip the job postings down to what actually matters for the project. No padding.

---

## Job 1: Upwork — Compliance Agent Developer

### Techs Mentioned (Explicitly or Implicitly)

| Tech | Relevance | Verdict | Why |
|---|---|---|---|
| **TypeScript** | Core | ✅ KEEP | Agent layer + frontend are TS |
| **Mastra.ai** | Core | ✅ KEEP | Explicitly asked; already planned |
| **LLM APIs** | Core | ✅ KEEP | OpenAI GPT-4o via Vercel AI SDK |
| **Document parsing** | Core | ✅ KEEP | WH-347 PDF/CSV extraction |
| **Structured/unstructured data** | Core | ✅ KEEP | Form extraction + LLM rationale |
| **React / modern frontend** | Implied | ✅ KEEP | Product UI, not demo page |
| **FastAPI / Python backend** | Implied | ✅ KEEP | Role says "AI developer" — Python for deterministic layer is standard |
| **PostgreSQL** | Implied | ✅ KEEP | Audit persistence, decision storage |
| **Redis** | Implied | ✅ KEEP | Caching, job queue |
| **Docker** | Implied | ✅ KEEP | One-command stack spinup |

### Techs NOT in Job 1 (But We Added Anyway)

| Tech | Verdict | Why |
|---|---|---|
| Elasticsearch | ✅ Defensible | Document retrieval for DBWD rates |
| pgvector | ✅ Defensible | Dense retrieval for semantic search |
| cross-encoder | ✅ Defensible | Reranking — standard RAG pattern |
| Phoenix | ⚠️ Stretch | Observability — makes the project look production-grade |
| Langfuse | ⚠️ Stretch | Prompt versioning — shows maturity |
| Celery | ⚠️ Stretch | Async jobs — defensible for batch payroll processing |
| TimescaleDB | ⚠️ Stretch | Time-series analytics — overkill but shows systems thinking |

---

## Job 2: Revenue Intelligence — Founding AI Infrastructure Engineer

### Techs Mentioned (Explicitly)

| Tech | Relevance | Verdict | Why |
|---|---|---|---|
| **Python** | Core | ✅ KEEP | Backend systems — deterministic layer |
| **Java** | Alternative | ❌ SKIP | Not relevant; we use Python |
| **Redshift** | Specific | ⚠️ ADAPT | Not needed for demo; **TimescaleDB** is the equivalent for time-series |
| **Elasticsearch** | Core | ✅ KEEP | BM25 search over documents |
| **Salesforce** | Specific | ❌ SKIP | Zero relevance to payroll compliance |
| **Redis** | Core | ✅ KEEP | Cached CRM state → cached contractor state |
| **Knowledge graphs** | Implied | ✅ KEEP | Entity relationships (WCP → Employee → Check → Verdict) |
| **Graph databases** | Future | ✅ KEEP | Neo4j-ready entity model |
| **Embedding models** | Core | ✅ KEEP | pgvector + sentence-transformers |
| **Vector search** | Core | ✅ KEEP | pgvector cosine similarity |
| **RAG pipelines** | Core | ✅ KEEP | Full retrieval → generation pipeline |
| **ML serving systems** | Stretch | ❌ SKIP | This is inference, not model serving |
| **LLM APIs** | Core | ✅ KEEP | OpenAI via Vercel AI SDK |
| **Function calling / tool use** | Core | ✅ KEEP | Mastra.ai tools calling Python services |
| **Prompt engineering** | Core | ✅ KEEP | Constrained reasoning, versioned prompts |
| **Phoenix** | Specific | ✅ KEEP | Explicitly named: "e.g., Phoenix" |
| **CI-based evaluation** | Core | ✅ KEEP | Golden set + regression detection |
| **Prompt versioning** | Core | ✅ KEEP | Langfuse prompt registry |
| **A/B testing** | Core | ✅ KEEP | Langfuse 50/50 routing |
| **Per-account config** | Implied | ⚠️ ADAPT | Different contractor tiers = different prompt configs |
| **Cost tracking** | Core | ✅ KEEP | Per-decision token usage |
| **OpenTelemetry** | Core | ✅ KEEP | Distributed tracing across services |
| **SQL-heavy data systems** | Core | ✅ KEEP | PostgreSQL with complex schema |
| **Entity-based abstractions** | Core | ✅ KEEP | Rich typed entities |
| **Graph-based systems** | Future | ✅ KEEP | Neo4j-ready model |

---

## The Definitive Tech List

### Core Stack (Must Have — Directly Matches Both Jobs)

| Layer | Tech | Job Match |
|---|---|---|
| **Frontend** | React 19 + Vite + Tailwind + Shadcn/ui | Job 1: "modern app" |
| **Agent Gateway** | Hono (TypeScript) | Both: production backend |
| **LLM Orchestration** | Mastra.ai + Vercel AI SDK + OpenAI GPT-4o | Job 1: explicit; Job 2: LLM APIs, tool use |
| **Deterministic Backend** | Python + FastAPI + Pydantic v2 | Job 2: Python backend |
| **Database** | PostgreSQL 16 + asyncpg + Alembic | Job 2: SQL-heavy data |
| **Cache/Queue** | Redis 7 + aioredis + Celery | Job 2: Redis-cached state |
| **Search** | Elasticsearch 8 (BM25) | Job 2: Elasticsearch |
| **Vector Search** | pgvector (PostgreSQL extension) | Job 2: vector search |
| **Reranking** | sentence-transformers (cross-encoder) | Job 2: embeddings |
| **Prompt Infra** | Langfuse (versioning, A/B, cost) | Job 2: prompt versioning, A/B, cost tracking |
| **Observability** | Phoenix/Arize + OpenTelemetry | Job 2: "e.g., Phoenix" |
| **Testing** | pytest + golden set + regression CI | Job 2: CI evaluation frameworks |
| **Entity Model** | NetworkX now, Neo4j-ready future | Job 2: knowledge graphs, entity resolution |
| **Document Parsing** | pdfplumber + pypdf | Job 1: document parsing |
| **Time-Series** | TimescaleDB (PostgreSQL extension) | Job 2: Redshift equivalent for analytics |
| **Deployment** | Docker Compose + GitHub Actions | Both: production deployment |

### Stretch Stack (Defensible But Not Core)

| Tech | Why | Honest Framing |
|---|---|---|
| **SAM.gov ETL** | Live DBWD rate ingestion | "Architecture supports live rates; demo uses seeded data" |
| **Flower (Celery UI)** | Queue monitoring | "Production-grade job queue observability" |
| **LLM-as-judge** | Prompt quality evaluation | "Secondary evaluation layer for prompt A/B testing" |
| **SSE real-time updates** | Frontend live pipeline display | "Real-time decision streaming" |

### Excluded (Padding — Zero Relevance)

| Tech | Why Excluded |
|---|---|
| **Salesforce** | Payroll compliance has no CRM component |
| **Redshift** | Not needed at demo scale; TimescaleDB covers the pattern |
| **Java** | Not used; Python is the backend language |
| **ML serving systems** | This is inference (LLM API calls), not model hosting |
| **Unstructured.io** | pdfplumber handles WH-347s; no need for enterprise parsing |
| **tesseract.js** | Demo uses text-layer PDFs; OCR is a Phase 2 extension at best |

---

## Honest Narrative

> "The stack covers every requirement from both roles. TypeScript for the agent layer and frontend. Python for deterministic backend systems. PostgreSQL with pgvector for relational + vector. Elasticsearch for BM25 search. Redis for caching and Celery queues. Phoenix for LLM observability. Langfuse for prompt versioning and cost tracking. TimescaleDB for time-series analytics. Everything wired together with Docker Compose."
>
> "What I didn't include: Salesforce (no CRM in payroll), Redshift (TimescaleDB covers the analytics pattern), Java (we use Python). Every tech in the stack has a direct line to one of the job requirements."

---

*This is the honest list. 17 core technologies, 4 stretch additions, 6 explicitly excluded. No padding.*
