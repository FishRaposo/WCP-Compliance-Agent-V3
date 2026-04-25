# Interview Preparation

**Pre-prepared answers for common interview questions based on V3 architecture.**

---

## Quick Start: Adapt by Role

Before the interview, identify which aspects of this project to emphasize:

| Role Type | Lead With | Supporting Evidence |
|---|---|---|
| **AI Agent Developer** | Mastra.ai, tool-use, structured output | Integration layer middleware, prompt versioning |
| **AI Infrastructure Engineer** | Hybrid RAG, evaluation pipeline, Python backend | Celery, pgvector, golden set regression |
| **Senior Full-Stack** | Polyglot architecture, service boundaries | Type safety, Docker deployment, testing |
| **Backend/Infrastructure** | FastAPI, async patterns, data systems | PostgreSQL, Redis, observability |

---

## Opening Pitch (30 seconds)

> "I built a three-service AI compliance platform: Python for deterministic logic and hybrid RAG, TypeScript with Mastra.ai for agent orchestration, React for the UI. It validates Davis-Bacon Act payroll using a three-layer pipeline: extract fields, validate against federal wage rates, LLM synthesizes findings with citations, then trust-score routing. Every decision is auditable with immutable records — appropriate engineering for federal compliance, not resume padding."

---

## Defensive Talking Points (Pre-empting Skepticism)

### "Isn't this over-engineered for a portfolio project?"

> "Federal wage compliance isn't a toy domain. Davis-Bacon Act violations carry back wage penalties, interest, and contractor debarment. The Department of Labor audits 7 years back. You need deterministic validation, immutable audit trails, and defensible decision logic."

> "Three services provides resilience—if Python backend degrades, Node.js can queue and cache. Deterministic validation means wage math is exact, not 'mostly right.' Golden set regression means broken calculations can't deploy. This is appropriate engineering for the domain."

### "Why not a simpler monolith?"

> "A monolith would be faster to build, but federal compliance demands separation of concerns. The TypeScript layer handles I/O-bound orchestration—external APIs, middleware, cross-service coordination. Python handles CPU-bound validation—extraction, math, rules, testing."

> "Node.js's async I/O is genuinely better for concurrent API calls. Python's ecosystem is genuinely better for deterministic validation. The boundary is clean: Node for 'intelligent reasoning,' Python for 'provable correctness.'"

### "Why Node.js for the integration layer instead of Python?"

> "Node.js's event loop excels at I/O-bound work—concurrent API calls to SAM.gov, Python backend, and LLM without blocking. Python's GIL makes it less suited for orchestration, but unmatched for CPU-bound data processing."

> "TypeScript's type safety also catches contract mismatches between frontend and backend at build time. The middleware ecosystem (Hono, Express patterns) is production-ready. It's the right tool for this specific job."

### "What did you learn from V2 to V3?"

> "V2 proved LLM-based compliance was feasible, but it was a TypeScript monolith with stubbed retrieval and in-memory queues—not production-ready for federal compliance."

> "V3 matures the architecture: Node.js integration layer for I/O-bound orchestration, Python backend for deterministic validation and rigorous testing, proper hybrid RAG, persistent job queues, and production observability. It's the evolution from 'proof-of-concept' to 'production architecture for safety-critical infrastructure.'"

---

## Deep Dives

### "Walk me through your RAG architecture."

> "Three-stage hybrid retrieval. First, parallel candidate generation: Elasticsearch BM25 for exact lexical match on trade codes and localities, plus pgvector for semantic similarity on trade descriptions. Second, Reciprocal Rank Fusion to combine the scores. Third, a cross-encoder reranks the top 20 candidates for precision. The cross-encoder is slower but only runs on 20 docs, so latency stays under 200ms."

> "I implemented it with Elasticsearch, PostgreSQL+pgvector, and sentence-transformers. This is the same architecture used by production search systems — lexical for exact match, vector for semantic similarity, reranker for final quality."

### "How do you evaluate your AI system?"

> "A 100-example golden set with CI-based regression detection. Every PR that touches prompts or retrieval runs the full set. We hard-fail if any example drops more than 0.05 in trust score, or if overall accuracy drops 2%."

> "I also use LLM-as-judge: a secondary LLM scores the primary LLM's output on accuracy, citation completeness, reasoning clarity, and cost efficiency. This feeds into A/B testing."

### "How do you manage prompts in production?"

> "Langfuse owns the prompt infrastructure. Every prompt gets a version hash. I can route 50/50 traffic between versions, compare trust scores, and promote the winner. Langfuse also tracks per-prompt cost and latency. For per-account configuration, prompts include metadata fields like `org_id` and `tier` so different contractor types get different templates."

### "How do you observe LLM calls?"

> "Phoenix for LLM-specific observability: trace visualization, prompt evaluation, drift detection. Langfuse for prompt versioning and cost. OpenTelemetry ties it all together across the Python backend and TypeScript agent. I can trace a single decision from the React upload through Mastra agent execution to Python validation and back."

### "Why three services instead of one?"

> "Separation of concerns. The architecture separates deterministic logic (Python), agent orchestration (TypeScript), and presentation (React). Neither role would be fully covered by a monolith. The service boundaries align with separation of concerns: deterministic logic in Python, agent orchestration in TypeScript, UI in React."

### "What does your TypeScript layer handle beyond LLM orchestration?"

> "The TypeScript Agent Gateway is the integration layer. It handles all middleware—auth, rate limiting, CORS, request validation. It integrates external APIs like SAM.gov for live wage rates. It orchestrates cross-service communication: frontend → Python backend → LLM → response. Mastra.ai handles the agent reasoning, but the layer itself is a production Node.js backend demonstrating full-stack TypeScript capability."

> "This positions the TypeScript service as more than just 'the AI part'—it's the integration hub that connects everything together."

### "Why pgvector over Pinecone or Weaviate?"

> "Production pragmatism. I already need PostgreSQL for relational data — decisions, audit events, jobs. pgvector adds vector search to the same database. One less service to operate, ACID transactions across relational and vector writes, lower cost."

> "At this scale — thousands of wage determinations, not billions — pgvector is sufficient. If I hit scale limits, I'd evaluate Pinecone, but I'd start with the simplest thing that works."

### "Tell me about your async task queue."

> "Celery with Redis broker. I use it for PDF extraction, batch CSV processing, and background evaluation runs. Celery is the standard for Python task queues — it shows I understand production infrastructure. Flower gives me a monitoring dashboard."

> "I evaluated ARQ, which is lighter and async-native, but Celery is more recognizable and aligns with production infrastructure patterns."

### "How do you handle the trust score?"

> "Four components: deterministic check confidence, LLM classification confidence, LLM self-assessed confidence, and agreement between layers. Weighted combination into a 0.0-1.0 score. Bands: >0.85 auto-approve, 0.60-0.85 flag for review, <0.60 require human decision."

> "The score is calibrated against the golden set. If scores drift in CI, the build fails."

### "What's your proudest technical decision?"

> "The hybrid RAG architecture. It wasn't just implementing BM25 + vector search — it was designing the chunking strategy around trade×locality×effective_date, the fusion logic with RRF, and the reranker selection. The cross-encoder choice was deliberate: it's more accurate than bi-encoders and the latency is acceptable because we only rerank 20 candidates."

> "Or maybe the evaluation pipeline. Golden sets with regression detection separate toy demos from production systems."

---

## Handling Gaps

### "Why not Neo4j?"

> "The entity model is graph-ready — WCP connects to Employees, Employees to Checks, Checks to Verdicts. I used NetworkX for in-memory graph operations. Neo4j is deferred to Phase 2; the current scale doesn't justify the operational overhead."

### "Why not LangGraph instead of Mastra?"

> "If I were building purely for infrastructure demonstration, I'd use LangGraph. But the three-service architecture lets me demonstrate both: Mastra for agent orchestration in TypeScript, Python for the heavy infrastructure. It shows I can evaluate and select frameworks based on requirements."

### "What's your weakest area in this project?"

> "Frontend polish. I focused on the AI/infra layer — hybrid RAG, eval pipelines, observability. The React UI is functional but not visually stunning. If the role is full-stack heavy, I'd invest more in animations and design system rigor."

---

## Questions to Ask Them

Use these to demonstrate domain knowledge and assess fit:

1. "Your job description mentioned hybrid search with cross-encoders — are you currently using that architecture in production?"
2. "For prompt infrastructure, are you using Langfuse, LangSmith, or something custom?"
3. "What's the scale of your retrieval corpus? Thousands of docs or billions?"
4. "How do you currently handle eval and regression detection?"
5. "Is the team more Python-heavy or TypeScript-heavy?"
6. "What does your production deployment look like? Kubernetes, ECS, or something else?"
7. "How do you handle observability across services? Do you have distributed tracing in place?"

---

## Project-Specific Talking Points

### V3 Architecture Summary

> "I built a compliance decision engine, but the architecture maps directly to revenue intelligence. Three services: Python handles deterministic extraction and validation — the same pattern as analytics pipelines processing structured data at scale. TypeScript with Mastra orchestrates LLM reasoning — the same as tool-use functions integrating search and CRM state. React provides the product face."

> "For observability, I integrated Phoenix for LLM tracing and Langfuse for prompt versioning with A/B testing. The evaluation pipeline runs a 100-example golden set in CI — regression detection hard-fails the build if trust scores drift."

> "The RAG layer uses Elasticsearch BM25 for candidate generation, pgvector for dense similarity, and a cross-encoder for reranking. The entity model — WCP, Employee, Check, Verdict, TrustScore — is structured for graph expansion."

> "Everything spins up with docker-compose: Postgres, Redis, Elasticsearch, Phoenix, Python backend, Celery workers, TypeScript agent, and React frontend. One command, full stack."

### V4 Data Platform Summary

> "V3 was the AI system. V4 is the data platform on top of it. Every compliance decision produces data. I built DuckDB for OLAP analytics, Prefect for scheduled ETL, Redis Streams for real-time events. The dashboard shows decision trends, wage violations over time, and LLM cost curves — Recharts in the React frontend."

> "I also made the LLM layer model-agnostic. OpenAI for compliance-critical decisions, Claude for synthesis, Ollama for zero-cost local development. Fallback chain if providers fail. Shows I understand the model layer, not just API calls."

> "Great Expectations validates every DBWD rate ingestion before it hits the database. Schema checks, range validation, no nulls. This is how you build data quality into the pipeline, not bolt it on later."

### Excluded Technologies Defense

> "I could have added Kubernetes, TimescaleDB, and Pinecone to pad my resume. Instead, I chose technologies that fit the scale and requirements of the project. PostgreSQL handles time-series aggregates. pgvector handles vector search. Docker Compose handles orchestration. Every technology has a clear justification."

---

## Quick Metrics Reference

**Performance:**
- P99 latency under 5 seconds end-to-end, sub-200ms for RAG retrieval
- RAG breakdown: BM25 < 50ms, vector search < 30ms, reranking < 100ms

**Quality:**
- 95% accuracy on the golden set with Spearman ρ > 0.7 for trust calibration
- 90%+ citation coverage for legal defensibility
- < 5% false positive rate, < 2% false negative rate

**Cost:**
- $0.05-0.15 per decision (GPT-4o-mini to GPT-4o)
- 5× cheaper than manual review at $0.50
- 2,000-4,000 tokens per decision average

**Scale (V4):**
- V3: thousands of records, V4: millions with PostgreSQL partitioning
- 99%+ data quality pass rate with Great Expectations
- < 1 hour data freshness from source to query

---

## Related

- [CAREER_POSITIONING.md](CAREER_POSITIONING.md) — Strategic narrative and transferable skills
- [JOB_COVERAGE.md](JOB_COVERAGE.md) — Detailed requirement mapping for reference
- [../metrics/METRICS_GUIDE.md](../metrics/METRICS_GUIDE.md) — Complete metrics reference

---

*Generated: 2026-04-22*
