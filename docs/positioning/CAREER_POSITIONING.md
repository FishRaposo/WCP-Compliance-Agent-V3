# Career Positioning

**Strategic narrative for how this project demonstrates senior engineering capabilities.**

---

## Author Context

**Background:** AI Infrastructure Architect specializing in production LLM systems, RAG pipelines, and agent orchestration. Full-stack with Python (FastAPI, Pydantic, Celery) and TypeScript (Hono, Mastra.ai, React). Built systems for payroll compliance, content platforms, and crypto gaming.

**Why AI/Compliance:** The market is saturated with AI demos that work in notebooks but fail in production. I build the systems that don't — deterministic validation layers, hybrid RAG, evaluation pipelines, and observability from day one. Regulated domains like federal compliance force the discipline that every AI system needs.

**What I'm Looking For:** Freelance and contract work building production AI systems — RAG pipelines that survive real data, agent workflows that handle edge cases, and infrastructure that scales. Particularly interested in: RAG reliability audits, prototype-to-production conversions, and agent system design.

**Other Projects:** [fishraposo.github.io](https://fishraposo.github.io) — portfolio with live projects and case studies. 5-lane autonomous execution engine for career acceleration.

---

## What This Project Demonstrates

This isn't a toy demo or tutorial walkthrough. It's a production-grade architecture for federal compliance — a domain where violations carry real penalties (back wages, debarment, lawsuits). Every design decision prioritizes **correctness, auditability, and defensibility** over convenience.

**V3** is the AI system for multi-document batches: hybrid RAG, LLM orchestration, deterministic validation, evaluation as infrastructure. Handles batches of 10-100 WCPs with async Celery processing — suitable for contractor-level workloads (weekly payroll, monthly reporting) with thousands of records.

**V4 extends V3** (not a rewrite) with enterprise-scale capabilities: thousands of contracts, millions of historical payroll records, continuous bulk ingestion, middleware managing connections to external data sources (ERP, HR systems, SFTP drops). V3's multi-document batch processing continues working exactly as built.

**Key distinction:** V3 was a ground-up rewrite of V2. V4 is an **additive upgrade** — new modules for enterprise data management, but the same core AI architecture.

**Key Technical Differentiators:**

| Capability | Why It Matters |
|---|---|
| **Polyglot Service Architecture** | Split by concern, not by convenience. Node.js for I/O-bound orchestration (where its event loop excels), Python for CPU-bound validation (where its testing ecosystem dominates) |
| **Hybrid RAG at Production Scale** | Three-stage retrieval (BM25 + vector + rerank) isn't theoretical — it's the exact architecture used by production search systems, implemented here with real trade-offs (latency vs. precision) |
| **Deterministic Validation Layer** | LLMs handle synthesis; Python handles math. Wage calculations must be identical every run, so they live in pytest-tested code, not prompt-dependent reasoning |
| **Evaluation as Infrastructure** | Golden set regression testing means broken calculations can't deploy. This is how you ship AI to regulated industries |
| **Observability by Design** | Phoenix + Langfuse + OpenTelemetry from day one, not bolted on later. Full tracing across three services |
| **Multi-LLM Routing** | Model-agnostic LLM layer: OpenAI for critical compliance decisions, Anthropic Claude for synthesis, Ollama for local development. Fallback chains for resilience |
| **Enterprise Data Platform** | PostgreSQL partitioned for millions of records. DuckDB for OLAP across contract portfolios. Prefect for bulk ingestion. Middleware layer connects to external databases |
| **Full Data Lifecycle** | Bulk ingestion → validation → storage → analytics → visualization. Cross-contract analytics: violation trends, wage compliance by region, cost curves |
| **Database at Scale** | Contract management with full CRUD. Payroll database with millions of rows, historical search, partitioned tables for query performance |

---

## Transferable Skills

| Skill Demonstrated | Evidence in Project | Applicable Roles |
|---|---|---|
| **Polyglot Architecture** | Python + TypeScript + React with clear service boundaries | Senior Full-Stack Engineer, Platform Engineer, Staff Engineer |
| **AI/LLM Integration** | Mastra.ai agents, hybrid RAG, structured output, tool-use patterns | AI/ML Engineer, AI Platform Engineer, Applied AI Engineer |
| **Regulated Domain Expertise** | Davis-Bacon Act compliance, audit trails, immutable decision records | FinTech, HealthTech, GovTech, LegalTech engineering |
| **Production Infrastructure** | Celery task queues, Redis caching, Docker Compose, CI/CD | Backend Engineer, Infrastructure Engineer, SRE |
| **Testing & Quality Rigor** | Golden set regression, 100-example eval, LLM-as-judge, CI hard-fail | Staff Engineer, QA Lead, Platform Engineering |
| **Data System Design** | PostgreSQL + pgvector, Elasticsearch, hybrid retrieval, ACID transactions | Data Engineer, ML Platform Engineer |
| **API & Integration Design** | Hono middleware, external API clients (SAM.gov), service contracts | API Engineer, Integration Engineer |
| **Multi-LLM Infrastructure** | Model-agnostic routing (OpenAI + Anthropic + Ollama), cost/quality optimization, fallback chains | AI Platform Engineer, ML Infrastructure Engineer |
| **Data Platform Engineering** | DuckDB OLAP, Prefect pipelines, Parquet columnar storage, PostgreSQL/OLAP separation | Data Engineer, Analytics Engineer, Data Platform Engineer |
| **Database at Scale** | PostgreSQL partitioning for millions of records, bulk ingestion, historical search optimization | Database Engineer, Data Engineer |
| **Data Quality Engineering** | Great Expectations validation suites, schema enforcement, range checks, automated quarantine | Data Engineer, Data Quality Engineer |
| **Event Streaming** | Redis Streams for real-time decision events, consumer groups, SSE to frontend | Streaming Engineer, Event-Driven Architect |
| **Analytics & Visualization** | Recharts time-series dashboards, decision metrics, cost trends, RAG quality tracking | Analytics Engineer, Full-Stack Data |
| **Enterprise Integration** | Middleware layer managing external DB connections, SFTP, API clients, contract/payroll ingestion | Integration Engineer, Platform Engineer |

---

## Role Adaptation Guide

How to pitch this project for different interview contexts:

### AI Agent Developer / Applied AI Engineer

**Lead with:**
- Mastra.ai framework with tool-use and structured output
- Three-layer pipeline architecture (extract → validate → verdict)
- LLM reasoning with citation requirements
- Prompt versioning and A/B testing via Langfuse

**Emphasize:** You understand agent frameworks beyond just calling OpenAI. You designed systems where LLMs collaborate with deterministic validation, not replace it.

**Key talking points:**
- "I built a TypeScript integration layer that handles all middleware and external API orchestration — it’s a production Node.js backend, not just frontend-adjacent code"
- "The agent uses tool-use to call Python for deterministic work, keeping the boundary clean: LLM for reasoning, Python for provable correctness"

---

### AI Infrastructure Engineer / ML Platform Engineer

**Lead with:**
- Python backend with FastAPI, Pydantic v2, asyncpg
- Hybrid RAG: BM25 + pgvector + cross-encoder reranking
- Evaluation infrastructure: golden set, CI regression, LLM-as-judge
- Celery + Redis for async task processing

**Emphasize:** You own the full ML infrastructure stack — retrieval, evaluation, observability, not just model calling.

**Key talking points:**
- "I designed a three-stage hybrid retrieval system. BM25 for exact match, vector for semantic similarity, cross-encoder for final precision. Sub-200ms latency on the full pipeline."
- "The golden set is my quality gate. Any prompt or retrieval change that drops trust scores hard-fails CI."

---

### Senior Full-Stack Engineer / Staff Engineer

**Lead with:**
- Polyglot three-service architecture with clear separation of concerns
- End-to-end type safety (Pydantic → Zod contracts)
- Service independence: each layer testable standalone with mocks
- Docker Compose deployment of full stack

**Emphasize:** You think in systems, not just features. You can design architectures that multiple teams could work on simultaneously.

**Key talking points:**
- "Three services isn't over-engineering for federal compliance — it provides defense in depth. Frontend can't accidentally call backend directly."
- "Each service is independently testable. Frontend devs don't need the backend running."

---

### Data Engineer / Analytics Engineer

**Lead with:**
- DuckDB for OLAP analytics on compliance decisions (in-process, reads live PostgreSQL)
- Prefect for scheduled ETL pipelines with retries and backfill
- Great Expectations for data quality validation on ingestion
- Redis Streams for real-time decision events
- Parquet columnar storage for decision archives

**Emphasize:** You understand the full data lifecycle: ingestion → validation → storage → analytics → visualization. You separate OLTP from OLAP at the right scale.

**Key talking points:**
- "I built DuckDB on top of existing PostgreSQL. No new server needed — it reads directly from Postgres and Parquet archives. 10-100× faster for analytical queries."
- "Prefect pipelines handle DBWD rate ingestion with automatic retries. Great Expectations validates every batch — schema checks, range validation, no nulls. Failed batches get quarantined for human review."
- "Redis Streams feeds real-time analytics to the React dashboard. Decision events stream from Python backend → Redis → TypeScript agent → SSE → Recharts."

---

### Backend / Infrastructure Engineer (Non-AI focused)

**Lead with:**
- Python production backend with FastAPI, SQLAlchemy 2.0, Alembic migrations
- PostgreSQL + Redis + Elasticsearch data layer
- Celery async task queue with Flower monitoring
- OpenTelemetry tracing across services

**Emphasize:** Solid backend fundamentals apply whether you're building AI systems or CRUD apps. You understand the infrastructure layer.

**Key talking points:**
- "The async architecture separates I/O-bound orchestration (Node.js) from CPU-bound validation (Python). Each language where it performs best."
- "The evaluation pipeline demonstrates production testing discipline — regression detection, not just unit tests."

---

## Architecture Decisions Summary

| Decision | Rationale |
|---|---|
| **3 services (Python + TS + React)** | Minimum architecture demonstrating polyglot design and clear separation of concerns |
| **Integration Layer pattern** | TypeScript Gateway handles middleware, external APIs, and cross-service coordination — Node.js's event loop excels at I/O-bound work |
| **Mastra.ai** | TypeScript-native agent framework with structured output and tool-use patterns |
| **Langfuse** | Production prompt infrastructure: versioning, A/B testing, cost tracking |
| **Phoenix** | LLM-specific observability with trace visualization and drift detection |
| **Hybrid RAG (BM25 + vector + rerank)** | Three-stage retrieval for precision: lexical + semantic + cross-encoder quality filter |
| **Celery** | Industry-standard Python task queue for async processing |
| **pgvector over dedicated vector DB** | Pragmatism: one database for relational + vector, ACID transactions, operational simplicity |
| **redis.asyncio** | Current Python async best practice (aioredis deprecated) |
| **Multi-LLM Routing (V3.1)** | Model-agnostic architecture: OpenAI for critical decisions, Anthropic for synthesis, Ollama for local dev. Fallback chains for resilience |
| **DuckDB (V4)** | In-process OLAP: 10-100× faster than PostgreSQL for analytics, reads live Postgres + Parquet, no separate server |
| **Prefect (V4)** | Modern Python-native workflow orchestration. Lighter than Airflow, better UX than Dagster for portfolio scale |
| **Redis Streams (V4)** | Event streaming without Kafka overhead. Already have Redis, provides consumer groups and persistence |
| **Great Expectations (V4)** | Data quality as code: schema validation, range checks, automated quarantine on ingestion failure |
| **Parquet (V4)** | Columnar format standard for analytics. Efficient compression, DuckDB-native, time-series archive |
| **Recharts (V4)** | React-native charting for product analytics. Grafana is infrastructure monitoring, not business analytics |

---

## Explicitly Excluded Technologies

Technologies considered but rejected with clear engineering rationale:

### Over-Engineering / Wrong Scale
| Technology | Why Excluded | Alternative |
|---|---|---|
| **TimescaleDB** | Overkill for basic time-series aggregations | PostgreSQL GROUP BY |
| **Redshift** | Wrong scale, wrong domain for WCP compliance | PostgreSQL |
| **BigQuery** | Unnecessary cloud dependency | PostgreSQL |
| **Kubernetes** | Overkill for MVP | Docker Compose |
| **Prometheus/Grafana** | Deferred to Phase 2 | Phoenix + Langfuse sufficient |

### Redundancy
| Technology | Why Excluded | Alternative |
|---|---|---|
| **Zustand** | Unnecessary state management | TanStack Query + useState |
| **pypdf / PyPDF2** | Redundant with pdfplumber | pdfplumber |
| **aioredis** | Deprecated 2023 | redis.asyncio |
| **Pinecone / Weaviate / Chroma / Milvus** | Separate service unnecessary | pgvector |

### Wrong Fit
| Technology | Why Excluded | Alternative |
|---|---|---|
| **Flask / Django** | Inferior for async ML APIs | FastAPI |
| **psycopg2** | Sync-only, doesn't fit async architecture | asyncpg |
| **FAISS** | Non-persistent, in-memory only | pgvector |
| **Jest** | Inferior to Vitest for Vite | Vitest |
| **Selenium** | Legacy tool | Playwright |
| **Weights & Biases** | ML experiment tracking, not LLM eval | Langfuse + custom eval |

### Vendor Lock-in
| Technology | Why Excluded | Alternative |
|---|---|---|
| **AWS / GCP / Azure** | Premature vendor lock-in | Render + Vercel |
| **Amazon Neptune** | Managed graph DB overkill | NetworkX (now), Neo4j (future) |

### V4 / Data Platform Alternatives

| Technology | Why Excluded | Alternative (V4) |
|---|---|---|
| **Snowflake / BigQuery** | Cloud vendor lock-in, overkill for portfolio scale | DuckDB (in-process, no server, reads PG directly) |
| **Apache Airflow** | Heavy operational overhead, complex setup for solo developer | Prefect (lighter, Python-native, better UX) |
| **Apache Kafka** | Massive overkill for 100 decisions/day. Kafka for compliance system is resume padding | Redis Streams (already have Redis, same patterns at right scale) |
| **Grafana** | Infrastructure monitoring, not product analytics | Recharts + React (native to stack, business analytics) |
| **D3.js** | Too low-level for dashboard needs. Would require significant custom code | Recharts (React-native, sufficient for time-series) |
| **dbt** | Overkill without proper data warehouse. At this scale, SQL views + DuckDB sufficient | DuckDB + PostgreSQL materialized views |
| **MLflow / Weights & Biases** | Model experiment tracking, not compliance decision evaluation | Custom eval framework + golden set + Langfuse |

---

## Related Documents

- [JOB_COVERAGE.md](JOB_COVERAGE.md) — Detailed mapping to specific job posting requirements
- [INTERVIEW_PREP.md](INTERVIEW_PREP.md) — Pre-prepared answers for common questions
- [V2_TO_V3_TRANSITION.md](../../V2_TO_V3_TRANSITION.md) — Architectural evolution from V2 to V3
- [V3_PLAN.md](../../V3_PLAN.md) — Current AI system architecture
- [V4_PLAN.md](../planning/V4_PLAN.md) — Data platform layer specification

---

*Generated: 2026-04-22*
