# Evaluation Pipeline

**CI-based evaluation framework ensuring all prompt or retrieval changes are validated before production.**

---

## Overview

The evaluation pipeline guards against regression in the WCP compliance agent. Every code change that affects prompts, RAG, or deterministic logic must pass the golden set before deployment.

**System Requirement:** CI-based evaluation frameworks ensuring all prompt or retrieval changes are validated before production.

**Python-First Evaluation:**

All evaluation infrastructure lives in the Python backend:
- Golden set execution via pytest
- Regression detection algorithms
- LLM-as-judge scoring implementation
- Benchmark metrics calculation

The TypeScript agent layer participates in evaluation only as the orchestration layer being tested—actual scoring, validation, and baseline management happens in Python.

---

## Golden Set

**100 labeled examples** covering:
- All 20 construction trades in the corpus
- Edge cases: overtime, fringe benefits, misclassification, missing signatures
- Both approved and rejected decisions
- Varying trust score bands (auto, flag, human review)

### Format

```json
{
  "id": "eval_001",
  "input": {
    "content": "Role: Electrician, Hours: 40, Wage: 51.69, Fringe: 34.63",
    "trade_code": "ELEC",
    "locality": "Boston, MA"
  },
  "expected": {
    "final_status": "Approved",
    "expected_checks": ["wage_check_001", "fringe_check_001"],
    "minimum_trust_score": 0.85,
    "expected_regulations": ["40 U.S.C. § 3142", "29 CFR 5.5(a)(1)"]
  },
  "metadata": {
    "trade": "Electrician",
    "scenario": "standard_hours_correct_wage",
    "difficulty": "easy"
  }
}
```

---

## Evaluation Dimensions & Scoring Rubrics

### 1. Decision Accuracy (Golden Set)

**Metric:** Binary correct/incorrect per decision

| Tier | Accuracy | Interpretation |
|---|---|---|
| **Excellent** | ≥ 98% | Production-ready; minimal human review needed |
| **Acceptable** | 95-98% | Human review threshold (trust scores < 0.80) |
| **Needs Work** | 90-95% | High human review volume; prompt engineering required |
| **Unacceptable** | < 90% | System not deployable |

**Measurement:**
```python
accuracy = sum(1 for e in golden_set if e.actual == e.expected) / len(golden_set)
```

### 2. Trust Score Calibration

**Metric:** Spearman rank correlation between trust_score and correctness

| ρ Value | Calibration | Action |
|---|---|---|
| **> 0.85** | Excellent | Trust scores reliable for auto-approval |
| **0.70-0.85** | Good | Human review threshold at 0.60-0.70 appropriate |
| **0.50-0.70** | Poor | Trust scores noisy; adjust scoring algorithm |
| **< 0.50** | Broken | Trust scores not meaningful; redesign |

**Measurement:**
```python
from scipy.stats import spearmanr
scores = [e.trust_score for e in golden_set]
correct = [1 if e.actual == e.expected else 0 for e in golden_set]
rho, p = spearmanr(scores, correct)
```

### 3. RAG Retrieval Quality

**Metric 1: Precision@K** — % of top-K results that are relevant

| K | Target | Why |
|---|---|---|
| **Precision@1** | > 80% | First result should usually be correct |
| **Precision@3** | > 90% | Top 3 should contain the correct rate |
| **Precision@5** | > 95% | Broad recall for the reranker to work with |

**Metric 2: Mean Reciprocal Rank (MRR)**

| MRR | Interpretation |
|---|---|
| **> 0.85** | Correct rate usually in top 1-2 results |
| **0.70-0.85** | Correct rate usually in top 2-3 |
| **< 0.70** | RAG needs improvement (BM25 tuning, embedding quality) |

**Metric 3: Latency**

| Stage | Target | Measurement |
|---|---|---|
| **BM25 candidate generation** | < 50ms | Elasticsearch query time |
| **Vector similarity search** | < 30ms | pgvector query time |
| **Cross-encoder reranking** | < 100ms | Model inference on top-10 candidates |
| **Total RAG latency** | < 200ms | Sum of above |

### 4. LLM-as-Judge Scoring Rubric

**Judge dimensions (0-10 scale):**

| Dimension | 10 (Excellent) | 5 (Acceptable) | 0 (Poor) |
|---|---|---|---|
| **Accuracy** | Verdict exactly matches expected; all checks correct | Verdict correct but minor check errors | Verdict incorrect |
| **Citation Completeness** | All relevant regulations cited; 40 U.S.C. § 3142, 29 CFR 5.5, etc. | Most relevant regulations cited | Missing critical regulations |
| **Reasoning Clarity** | Clear, defensible logic; step-by-step wage/hours/fringe analysis | Logic understandable but not explicit | Confusing or contradictory reasoning |
| **Cost Efficiency** | Minimal tokens; concise output | Average token usage | Excessively verbose; redundant content |
| **Tone** | Professional, neutral, legally appropriate | Acceptable but bland | Inappropriate for legal context |

**Composite Judge Score:**
- **≥ 45/50:** Excellent — no changes needed
- **40-45:** Good — minor prompt tweaks
- **30-40:** Needs Improvement — significant prompt engineering
- **< 30:** Unacceptable — redesign prompt or model

### 5. Regression Detection Thresholds

**Hard-fail CI conditions:**

| Metric | Threshold | Consequence |
|---|---|---|
| **Accuracy drop** | > 2% from baseline | Block deployment |
| **Trust score drift** | > 0.05 mean drop | Block deployment |
| **Latency regression** | P99 > 50% increase | Block deployment |
| **New failure mode** | Any previously unseen error type | Flag for review |
| **Judge score drop** | > 5 points composite | Warn, manual review |

**Soft-warn conditions (alert but don't block):**
- Token usage > 10% increase (cost concern)
- Single example trust score drop > 0.10 (investigate)

---

## Regression Detection

**Hard-fail conditions:**

1. Any example drops > 0.05 trust score from baseline
2. Overall accuracy drops > 2% from baseline
3. P99 latency increases > 50% from baseline
4. New error type introduced (previously unseen failure mode)

**CI Integration:**

```yaml
# .github/workflows/eval.yml
- name: Run Golden Set
  run: cd backend && pytest tests/eval/ --benchmark-only

- name: Regression Check
  run: python tests/eval/regression_test.py
  # Compares current against stored baseline
  # Fails if any hard-fail condition triggered
```

---

## LLM-as-Judge

**Secondary LLM evaluates primary LLM output quality.**

**System Requirement:** Scoring rubrics for automated quality assessment.

### Rubric

```typescript
// agent/src/prompts/evaluation/judge.ts
interface JudgeScore {
  accuracy: number;              // 0-10: Did the verdict match expected?
  citation_completeness: number; // 0-10: Were all relevant regulations cited?
  reasoning_clarity: number;     // 0-10: Is the rationale clear and defensible?
  cost_efficiency: number;       // 0-10: Was the prompt efficient (fewest tokens)?
}
```

### A/B Testing

```python
# Route 50/50 to prompt versions
# Compare trust scores, judge scores, and latency
# Winner promoted to 100%
```

---

## Evaluation Workflow

```
Developer pushes branch
         │
         ▼
┌─────────────────────┐
│  CI: Build + Test  │
│  Unit tests pass   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  CI: Golden Set    │
│  100 examples run  │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Regression Check  │
│  Compare to baseline│
└─────────┬───────────┘
          │
    ┌─────┴─────┐
    ▼           ▼
┌───────┐   ┌─────────┐
│ PASS  │   │  FAIL   │
│ Merge │   │ Block   │
└───────┘   └─────────┘
```

---

## Running Evaluations Locally

```bash
# Full golden set
cd backend
pytest tests/eval/test_golden_set.py -v

# Single example
pytest tests/eval/test_golden_set.py -k "eval_001" -v

# With benchmark
pytest tests/eval/ --benchmark-only

# Update baseline (careful!)
python tests/eval/update_baseline.py
```

---

## Related

- [ADR-004: Langfuse](adrs/ADR-004-langfuse.md) — Prompt versioning, A/B testing
- [ADR-005: Hybrid RAG](adrs/ADR-005-hybrid-rag.md) — RAG evaluation
