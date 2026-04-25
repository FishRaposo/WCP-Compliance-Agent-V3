# ADR-009: Explicitly Excluded Technologies

**Status:** Accepted

**Date:** 2026-04-22

**Author:** Vinícius Raposo

---

## Context

V3 is a production AI compliance system. The temptation is to include every modern technology to demonstrate breadth. This ADR documents technologies we explicitly considered and rejected, with clear rationale for WCP compliance domain.

**Principle:** Every technology in the stack must justify its existence for this specific project. No architectural over-engineering.

---

## Exclusion Categories

### 1. Over-Engineering / Wrong Scale

#### TimescaleDB
- **Why considered:** Time-series analytics for decision volume trends
- **Why excluded:** PostgreSQL GROUP BY handles time-series aggregations perfectly at this scale. TimescaleDB adds Docker complexity with zero practical benefit for thousands of decisions.
- **Alternative:** PostgreSQL native aggregates with proper indexes

#### Redshift / BigQuery
- **Why considered:** Data warehousing for analytics at scale
- **Why excluded:** WCP compliance generates thousands of decisions, not billions. PostgreSQL satisfies "SQL-heavy data systems" without cloud vendor lock-in.
- **Alternative:** PostgreSQL + indexed analytics queries

#### Kubernetes
- **Why considered:** Container orchestration for production deployment
- **Why excluded:** Overkill for MVP. Docker Compose is sufficient for local dev, demos, and initial deployment. K8s adds massive operational complexity.
- **Alternative:** Docker Compose (now), Kubernetes (Phase 2 if scale demands)

#### Prometheus / Grafana
- **Why considered:** Industry standard for metrics and monitoring
- **Why excluded:** Phoenix (LLM observability) + Langfuse (prompt/cost) provide sufficient observability for MVP. Adding Prometheus/Grafana is premature optimization.
- **Alternative:** Phoenix + Langfuse (now), Prometheus (Phase 2)

---

### 2. Redundancy

#### Zustand
- **Why considered:** Global state management for React
- **Why excluded:** TanStack Query handles server state caching. React useState/useReducer handles local UI state. Adding Zustand is unnecessary indirection.
- **Alternative:** TanStack Query + useState

#### pypdf / PyPDF2
- **Why considered:** PDF parsing libraries
- **Why excluded:** pdfplumber is superior for structured PDFs with table extraction. Multiple PDF libraries signal indecision.
- **Alternative:** pdfplumber only

#### aioredis
- **Why excluded:** Deprecated in 2023, merged into redis-py
- **Detailed rationale:** See ADR-008 for full migration guide
- **Alternative:** `from redis.asyncio import Redis`

#### Pinecone / Weaviate / Chroma / Milvus
- **Why excluded:** pgvector in PostgreSQL handles vector search without separate service
- **Detailed rationale:** See ADR-007 for technical comparison and schema
- **Alternative:** pgvector

---

### 3. Wrong Fit

#### Flask / Django
- **Why considered:** Python web frameworks
- **Why excluded:** Flask is sync-only; Django is heavy ORM-focused. FastAPI is purpose-built for async ML/AI APIs with automatic OpenAPI docs.
- **Alternative:** FastAPI

#### psycopg2
- **Why considered:** PostgreSQL driver for Python
- **Why excluded:** Sync-only. FastAPI requires async throughout. asyncpg is the fastest async PostgreSQL driver.
- **Alternative:** asyncpg

#### FAISS
- **Why considered:** Facebook's vector search library
- **Why excluded:** In-memory only, doesn't persist, doesn't scale across workers. pgvector is persistent and queryable from any worker.
- **Alternative:** pgvector

#### Jest
- **Why considered:** JavaScript testing framework
- **Why excluded:** Vitest is faster, modern, and standard for Vite-based projects. Jest is older, slower, and requires more configuration.
- **Alternative:** Vitest

#### Selenium
- **Why considered:** Browser automation for E2E testing
- **Why excluded:** Playwright is the modern replacement with better API, faster execution, and more reliable selectors.
- **Alternative:** Playwright

#### Weights & Biases
- **Why considered:** ML experiment tracking
- **Why excluded:** W&B is for ML model training, not LLM prompt evaluation. Langfuse handles prompt versioning and cost tracking.
- **Alternative:** Langfuse + custom eval framework

---

### 4. Vendor Lock-in

#### AWS / GCP / Azure (for MVP)
- **Why considered:** Cloud deployment for scalability
- **Why excluded:** Premature vendor lock-in. Render + Vercel provide vendor-neutral deployment with free tiers. Can migrate to cloud later if needed.
- **Alternative:** Render (backend) + Vercel (frontend)

#### Amazon Neptune
- **Why considered:** Managed graph database
- **Why excluded:** Overkill, expensive, AWS-only. NetworkX handles entity graphs in-memory now; Neo4j (self-hosted) is the future path if needed.
- **Alternative:** NetworkX (now), Neo4j (future, self-hosted)

---

## Summary

| Category | Count |
|---|---|
| **Over-Engineering** | 5 technologies excluded |
| **Redundancy** | 4 technologies excluded |
| **Wrong Fit** | 6 technologies excluded |
| **Vendor Lock-in** | 2 technologies excluded |
| **Total Excluded** | **17 technologies** |

**Acceptance Rate:** 36 accepted out of 53 considered (68%)

---

## Related

- ADR-007: pgvector over dedicated vector DB (detailed vector DB comparison)
- ADR-008: redis.asyncio over aioredis (detailed Redis client migration)

---

## 5. Common Framework Technologies

Popular technologies in the AI/ML ecosystem evaluated against project requirements:

### LangChain
- **What it is:** Python framework for LLM application development
- **Why excluded:** Project explicitly uses Mastra.ai (TypeScript). LangChain would duplicate agent functionality in wrong language layer.
- **Alternative:** Mastra.ai for agents, custom Python code for backend logic
- **Verdict:** ❌ Excluded — Duplicates Mastra, wrong layer

### Hugging Face Transformers
- **What it is:** Self-hosted open-source LLMs (Llama, Mistral, etc.)
- **Why excluded:** Project uses OpenAI/GPT-4/Claude (API-based). Self-hosted requires GPU infrastructure. GPT-4o/o3-mini sufficient for compliance.
- **Alternative:** OpenAI API (now), HF inference endpoints (future if needed)
- **Verdict:** ❌ Excluded — Unnecessary complexity, API models sufficient

### Pandas / Polars
- **What it is:** Data manipulation libraries for Python
- **Evaluation:** ⚠️ Limited use — CSV bulk upload processing only. Avoid for SQL operations (use SQLAlchemy).
- **Where it fits:** `backend/src/pipeline/csv_processing.py`
- **Verdict:** ⚠️ Optional dependency only

### gRPC
- **What it is:** High-performance RPC framework, binary protocol
- **Why excluded:** REST sufficient for inter-service latency (<1ms in Docker network). gRPC adds proto complexity, harder to debug.
- **Alternative:** HTTP/REST (now), gRPC (Phase 2 if profiling shows need)
- **Verdict:** ❌ Excluded — REST sufficient, premature optimization

### Kafka
- **What it is:** Distributed event streaming platform
- **Why excluded:** Celery + Redis handles async queue. Kafka requires 3+ node cluster. Overkill for thousands/day, not millions/second.
- **Alternative:** Celery + Redis (now), Kafka (if scale exceeds 10k decisions/second)
- **Verdict:** ❌ Excluded — Massive overkill for current scale

### Dagster / Prefect
- **What they are:** Data orchestration platforms (workflow DAGs)
- **Why excluded:** SAM.gov ETL is single script (fetch → parse → upsert). Celery Beat handles scheduling. One pipeline doesn't justify orchestration platform.
- **Alternative:** Celery Beat (now), Dagster (future if pipeline count > 3)
- **Verdict:** ❌ Excluded — Overkill for single ETL pipeline

---

## Summary

| Category | Count |
|---|---|
| **Over-Engineering** | 5 technologies excluded |
| **Redundancy** | 4 technologies excluded |
| **Wrong Fit** | 6 technologies excluded |
| **Vendor Lock-in** | 2 technologies excluded |
| **Job Posting Techs** | 5 excluded, 1 limited |
| **Total Excluded** | **22 technologies** |

**Acceptance Rate:** 36 accepted out of 58 considered (62%)

---

*Generated: 2026-04-22*
