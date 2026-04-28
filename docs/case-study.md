# Case Study — WCP Compliance Agent V3

**How I built a production-grade AI decision engine for federal payroll compliance**

---

## The Problem

Federal construction projects in the US must comply with the Davis-Bacon Act — a law requiring contractors to pay workers the "prevailing wage" for their trade and locality. Violations carry real penalties: back wages, interest, contractor debarment, and class-action lawsuits. The Department of Labor audits up to 7 years back.

**The manual process is brutal.** Compliance officers review hundreds of Weekly Certified Payroll (WCP) forms, cross-referencing each worker's trade, hours, and wages against a 20-trade DBWD (Davis-Bacon Wage Determination) corpus. It's slow, error-prone, and doesn't scale.

**The AI opportunity was clear, but the constraints were hard:**
- Compliance decisions must be **deterministic and reproducible** — no "mostly correct" wage math
- Every decision needs **citation-backed reasoning** — auditable and legally defensible
- The system must handle **edge cases** — overtime, fringe benefits, misclassification, missing signatures
- **False positives are expensive** — flagging compliant submissions wastes reviewer time
- **False negatives are dangerous** — missing violations means legal liability

---

## The Architecture

I designed a three-service architecture where each layer has a clear responsibility:

```
React Frontend  →  TypeScript Agent Gateway  →  Python Deterministic Backend
(Presentation)      (Orchestration + LLM)        (Validation + RAG)
```

**Why three services, not a monolith:**

| Layer | Language | Why This Language |
|-------|----------|-------------------|
| **Frontend** | React 19 + TypeScript | Product UI, real-time updates via SSE |
| **Agent Gateway** | TypeScript (Hono + Mastra.ai) | I/O-bound orchestration — Node's event loop excels at concurrent API calls (SAM.gov, backend, LLM). TypeScript type safety catches contract mismatches at build time. |
| **Backend** | Python (FastAPI + Pydantic v2) | CPU-bound validation — Python's testing ecosystem (pytest, fixtures, parametrization) is unmatched for deterministic correctness. |

The key insight: **LLMs handle reasoning and synthesis. Python handles math and rules.** The boundaries are clean — the TypeScript agent never does math, the Python backend never calls an LLM directly.

---

## The Pipeline

Every WCP form goes through a 5-step decision pipeline:

### 1. Extract
`pdfplumber` parses structured fields from PDF payrolls — employee name, trade classification, hours worked, wages paid, fringe benefits.

### 2. Validate
Five deterministic check functions run against federal rules:
- **Wage check** — Does the reported rate meet the DBWD prevailing wage for this trade × locality?
- **Fringe check** — Are fringe benefits correctly calculated?
- **Overtime check** — Are overtime hours paid at 1.5× the base rate?
- **Signature check** — Is the WCP signed (legally required)?
- **Totals check** — Do the numbers add up?

Each check cites the specific regulation (e.g., "40 U.S.C. § 3142", "29 CFR 5.5(a)(1)").

### 3. LLM Verdict
The Mastra.ai agent synthesizes all check results into a structured decision. It doesn't do math — it interprets the deterministic results, identifies patterns, and produces a verdict with citations.

**Mock mode:** The system runs end-to-end without an OpenAI key. `LLM_MODE=mock` returns deterministic responses for development and CI.

### 4. Trust Score
A composite score (0.0–1.0) computed from:
- Deterministic check confidence
- LLM classification confidence
- LLM self-assessed confidence
- Agreement between deterministic and LLM layers

**Routing bands:**
| Score | Action |
|-------|--------|
| > 0.85 | Auto-approve |
| 0.60–0.85 | Flag for human review |
| < 0.60 | Require human decision |

### 5. Persist
Every decision is stored as an immutable record — audit trail, check results, LLM reasoning, trust score, and regulation citations. The Department of Labor can request these at any time.

---

## The RAG Layer

Retrieval is the backbone of the system. When the agent needs to verify a wage claim, it retrieves the correct prevailing wage from the DBWD corpus using a three-stage hybrid approach:

**Stage 1 — Parallel Candidate Generation**
- **Elasticsearch BM25** for exact lexical matching on trade codes and localities
- **pgvector** for semantic similarity on trade descriptions and wage determinations

**Stage 2 — Reciprocal Rank Fusion (RRF)**
Combines BM25 and vector scores into a single ranked list. BM25 catches exact matches ("Electrician" → "ELEC"). Vector search catches semantic matches ("wire installer" → "Electrician").

**Stage 3 — Cross-Encoder Reranking**
A cross-encoder reranks the top 20 candidates for precision. Slower than bi-encoders, but only runs on 20 documents — latency stays under 200ms.

**Why this architecture:**
- Production search systems use this exact pattern (lexical + semantic + rerank)
- pgvector over Pinecone — one less service, ACID transactions, lower cost
- The cross-encoder is the quality gate — BM25+vector gets you candidates, the reranker ensures precision

---

## Evaluation as Infrastructure

This is what separates a demo from a production system.

**Golden Set:** 100 labeled examples covering all 20 construction trades, edge cases, approved and rejected decisions, and varying trust score bands.

**CI Regression Detection:** Every PR that touches prompts or retrieval runs the full golden set. The build hard-fails if:
- Any example drops > 0.05 in trust score
- Overall accuracy drops > 2%

**LLM-as-Judge:** A secondary LLM scores the primary LLM's output on accuracy, citation completeness, reasoning clarity, and cost efficiency.

**Baseline Management:** Eval results are saved to `baseline_scores.json`. Regression testing compares current scores against baseline automatically.

---

## Observability

**Phoenix (Arize):** LLM-specific observability — trace visualization, prompt evaluation, drift detection. Every LLM call is traced end-to-end.

**Langfuse:** Prompt versioning with hash-based versioning, A/B testing (50/50 traffic split between versions), and per-prompt cost/latency tracking.

**OpenTelemetry:** Ties everything together across Python backend and TypeScript agent. A single decision can be traced from React upload → Mastra agent → Python validation → response.

---

## By The Numbers

| Metric | Value |
|--------|-------|
| Services | 3 (Python, TypeScript, React) |
| Tests | 116 passing (87 backend + 29 agent) |
| API Endpoints | 9 |
| Check Functions | 5 (wage, fringe, overtime, signature, totals) |
| DBWD Corpus | 20 construction trades |
| Golden Set | 100 labeled examples |
| Target Latency | < 5s end-to-end (P99), < 200ms RAG |
| Target Accuracy | 95%+ on golden set |
| Cost per Decision | $0.05–0.15 |

---

## What I'd Do Differently

1. **Started with eval infrastructure earlier.** The golden set and regression pipeline came in Phase 2. In hindsight, defining success metrics before writing code would have saved iteration time.

2. **Frontend-first development.** The backend and agent are solid. The React UI is functional but not polished. For portfolio impact, a beautiful demo that shows the pipeline in action would be more compelling than the raw API.

3. **Case study from day one.** Documenting decisions as they happen (ADRs, trade-offs) is easier than reconstructing them later. The ADRs exist but were written retrospectively.

---

## Transferable Lessons

This project demonstrates patterns that apply far beyond compliance:

| Pattern | Generalizes To |
|---------|----------------|
| Deterministic validation + LLM synthesis | Any domain where "mostly correct" isn't acceptable |
| Hybrid RAG (BM25 + vector + rerank) | Production search systems at any scale |
| Golden set regression testing | Any AI system that needs to maintain quality over time |
| Polyglot architecture by concern | Systems where one language can't serve all needs well |
| Observability from day one | Any system where debugging in production matters |
| Mock mode for development | Any system with expensive external dependencies |

---

## What This Proves

If you're evaluating whether I can build production AI systems:

1. **I don't just call APIs.** The architecture separates deterministic logic from LLM reasoning — the same pattern used by companies shipping AI to regulated industries.

2. **I test like it matters.** Golden sets, regression detection, CI hard-fail — this is how you prevent AI systems from silently degrading.

3. **I make deliberate technology choices.** Every technology in this project was selected for a specific reason. Every excluded technology was rejected with a documented rationale. No resume padding.

4. **I think in systems.** Three services, shared schemas, service contracts, cross-service tracing — this architecture scales to multiple teams.

5. **I ship.** 116 tests, 9 endpoints, end-to-end pipeline, mock mode. This isn't a whitepaper — it's running code.

---

*"70% of RAG systems fail in production. This one doesn't."*

---

**Author:** Vinícius Raposo ([GitHub](https://github.com/FishRaposo) · [Portfolio](https://fishraposo.github.io) · [Upwork](https://www.upwork.com/freelancers/fishraposo))
**License:** MIT © 2026
**Repo:** [github.com/FishRaposo/WCP-Compliance-Agent-V3](https://github.com/FishRaposo/WCP-Compliance-Agent-V3)
