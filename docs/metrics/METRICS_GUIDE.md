# Metrics Guide

Complete reference for all metrics, targets, and measurement approaches in the WCP Compliance Agent.

---

## Quick Reference: All Targets

| Category | Metric | Target | Where Measured |
|---|---|---|---|
| **Performance** | E2E Latency P99 | < 5s | Phoenix |
| **Performance** | RAG Latency | < 200ms | Backend instrumentation |
| **Performance** | PDF Extraction | < 500ms | pytest-benchmark |
| **Quality** | Decision Accuracy | ≥ 95% | Golden set eval |
| **Quality** | Trust Calibration | ρ > 0.7 | Golden set correlation |
| **Quality** | Citation Coverage | ≥ 90% | LLM-as-judge |
| **Quality** | False Positive Rate | < 5% | Confusion matrix |
| **Cost** | $/Decision | $0.05-0.15 | Langfuse |
| **Cost** | Cache Hit Rate | > 80% | Redis monitoring |
| **Scale (V4)** | Records | Millions | PostgreSQL |
| **Data Quality** | GE Pass Rate | > 99% | Prefect reports |
| **Analytics** | Query Time | < 5s | DuckDB instrumentation |

---

## V3 System Performance Metrics

### End-to-End Decision Latency

**Target:** P50 < 2s, P95 < 4s, P99 < 5s

**Measurement:**
```python
# Phoenix trace span from upload to verdict
from phoenix.trace import span

with span("wcp_decision", attributes={"contractor_id": cid}):
    # Full pipeline: extract → validate → verdict
    pass
```

**Why it matters:** Federal compliance decisions can't be slow. 5 seconds is the pain threshold for user experience.

**Technical highlight:** P99 latency under 5 seconds for the full decision pipeline — extraction, validation, RAG lookup, LLM reasoning, and persistence.

### RAG Retrieval Latency

**Target:** < 200ms for full three-stage retrieval

**Breakdown:**
| Stage | Target | Component |
|---|---|---|
| BM25 candidate generation | < 50ms | Elasticsearch |
| Vector similarity search | < 30ms | pgvector |
| Cross-encoder reranking | < 100ms | sentence-transformers |
| **Total** | **< 200ms** | **Combined** |

**Measurement:**
```python
import time

start = time.monotonic()
candidates = bm25_search(query)          # ~50ms
vectors = pgvector_search(query, top_k=10)  # ~30ms
reranked = cross_encoder.rerank(candidates + vectors)  # ~100ms
rag_latency = time.monotonic() - start
```

**Technical highlight:** Sub-200ms RAG latency leaves headroom for the LLM call, which is the real bottleneck at 1-2 seconds.

---

## AI/LLM Quality Metrics

### Decision Accuracy

**Target:** ≥ 95% on golden set

**Tiers:**
| Accuracy | Interpretation |
|---|---|
| ≥ 98% | Production-ready; minimal human review |
| 95-98% | Acceptable; human review at trust < 0.80 |
| 90-95% | Needs work; high review volume |
| < 90% | Not deployable |

**Measurement:**
```python
accuracy = sum(1 for e in golden_set if e.actual == e.expected) / len(golden_set)
```

**Technical highlight:** 95% accuracy means 1 error per 20 decisions; human review catches the rest at trust scores below 0.80.

### Trust Score Calibration

**Target:** Spearman ρ > 0.7

**Interpretation:**
| ρ | Calibration |
|---|---|
| > 0.85 | Excellent; trust scores reliable |
| 0.70-0.85 | Good; appropriate thresholds |
| 0.50-0.70 | Poor; scores noisy |
| < 0.50 | Broken; redesign needed |

**Measurement:**
```python
from scipy.stats import spearmanr

scores = [e.trust_score for e in golden_set]
correct = [1 if e.actual == e.expected else 0 for e in golden_set]
rho, p = spearmanr(scores, correct)
```

**Technical highlight:** Spearman correlation of 0.7+ between trust scores and actual correctness — high trust indicates high confidence in the decision.

---

## RAG Retrieval Quality Metrics

### Precision@K

**Definition:** Percentage of top-K results that are relevant

**Targets:**
| K | Target | Why |
|---|---|---|
| Precision@1 | > 80% | First result should be right |
| Precision@3 | > 90% | Top 3 contain correct rate |
| Precision@5 | > 95% | Recall for reranker |

**Measurement:**
```python
def precision_at_k(results, relevant_ids, k):
    top_k = results[:k]
    relevant_in_k = sum(1 for r in top_k if r.id in relevant_ids)
    return relevant_in_k / k
```

### Mean Reciprocal Rank (MRR)

**Target:** > 0.85

**Interpretation:**
| MRR | Meaning |
|---|---|
| > 0.85 | Correct result usually in top 1-2 |
| 0.70-0.85 | Correct result usually in top 2-3 |
| < 0.70 | RAG needs improvement |

**Measurement:**
```python
def reciprocal_rank(results, relevant_id):
    for i, r in enumerate(results, 1):
        if r.id == relevant_id:
            return 1 / i
    return 0

mrr = sum(reciprocal_rank(r.results, r.expected_id) for r in queries) / len(queries)
```

---

## Cost Efficiency Metrics

### Cost Per Decision

**Target:** $0.05 - $0.15

**Breakdown by model:**
| Model | Cost/1K Tokens | Typical Tokens | Cost/Decision |
|---|---|---|---|
| GPT-4o-mini | $0.0006 | 3,000 | ~$0.05 |
| GPT-4o | $0.005 | 3,000 | ~$0.15 |
| Claude Sonnet | $0.003 | 3,000 | ~$0.09 |
| Ollama (local) | $0 | 3,000 | $0 |

**ROI vs Manual Review:**
- Manual review cost: ~$0.50 per WCP (15 min @ $20/hr)
- AI decision cost: ~$0.10 per WCP
- **Cost reduction: 5×**

**Business case:** At $0.10 per decision vs $0.50 for manual review, that's 5× cost reduction — and the AI is faster and more consistent.

---

## V4 Data Platform Metrics

### Scale Comparisons (V3 vs V4)

| Metric | V3 | V4 | Multiplier |
|---|---|---|---|
| Concurrent contracts | 1-10 | 1,000+ | 100× |
| Payroll records | Thousands | Millions | 1000× |
| Historical depth | Current batch | 10 years | ∞ |
| Bulk ingestion | 100/batch | 10,000/batch | 100× |

### Data Quality Metrics

**Target:** > 99% batches pass Great Expectations validation

**Measurement:**
```python
# Great Expectations validation result
validation_result = context.run_checkpoint("dbwd_ingestion")
pass_rate = validation_result.statistics["success_percent"]
```

**Technical highlight:** 99%+ of ingestion batches pass automated data quality checks. Failed batches get quarantined for human review, not loaded into the database.

### Analytics Dashboard KPIs

| KPI | Target | Business Question |
|---|---|---|
| Decision volume trend | Baseline ± 20% | Is workload growing? |
| Approval rate by trade | 70-90% range | Which trades have violations? |
| Wage violation rate | < 15% | Are contractors compliant? |
| Average trust score | > 0.75 | Is AI confident? |
| Cost per decision trend | Decreasing | Are we optimizing? |
| Human review queue | < 50 pending | Is capacity sufficient? |

---

## Regression Detection

### Hard-Fail Conditions (Block Deployment)

| Metric | Threshold | Action |
|---|---|---|
| Accuracy drop | > 2% from baseline | Block |
| Trust score drift | > 0.05 mean drop | Block |
| Latency regression | P99 > 50% increase | Block |
| New failure mode | Any unseen error | Flag + Review |

### Soft-Warn Conditions (Alert Only)

| Metric | Threshold | Action |
|---|---|---|
| Token increase | > 10% from baseline | Warn |
| Single example drop | > 0.10 trust score | Investigate |

---

## Quick Reference Summary

**Key metrics at a glance:**

1. **Performance:** P99 latency under 5 seconds end-to-end, sub-200ms for RAG retrieval

2. **Quality:** 95% accuracy on the golden set with Spearman ρ > 0.7 for trust calibration

3. **Cost:** $0.05-0.15 per decision, 5× cheaper than manual review at $0.50

4. **Scale:** V3 handles thousands of records; V4 scales to millions with PostgreSQL partitioning

5. **Data Quality:** 99%+ of batches pass automated validation; failed batches get quarantined

6. **Observability:** 100% trace coverage via Phoenix; every decision is auditable with full latency breakdowns

---

## Implementation Notes

### Where Metrics Are Measured

| Metric | Code Location | Tool |
|---|---|---|
| E2E Latency | `backend/src/pipeline/` | Phoenix spans |
| RAG Latency | `backend/src/retrieval/` | Custom timing |
| Accuracy | `backend/tests/eval/` | pytest + golden set |
| Trust Score | `agent/src/mastra/` | Calculated post-LLM |
| Cost | Both services | Langfuse auto-capture |
| Data Quality | `backend/src/pipelines/` | Great Expectations |

### Dashboards to Build

1. **Phoenix Dashboard:** LLM traces, token usage, latency percentiles
2. **Langfuse Dashboard:** Cost trends, prompt version comparison
3. **Custom Analytics (V4):** Recharts dashboard with business KPIs
4. **Grafana (future):** Infrastructure metrics, Redis queue depth, PostgreSQL performance

---

*Last updated: 2026-04-22*
