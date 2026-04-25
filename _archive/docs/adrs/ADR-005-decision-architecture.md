# ADR-005: Three-Layer Decision Architecture

**Status**: Accepted  
**Date**: 2026-04-17  
**Author**: WCP Compliance Agent Team  

---

## Context

The WCP Compliance Agent produces compliance decisions (Approved/Revise/Reject) for Weekly Certified Payrolls (WCPs). These decisions have regulatory implications under the Davis-Bacon Act (40 U.S.C. §§ 3141-3145). 

**Problem**: If an LLM is allowed to do its own arithmetic or rule-checking, it can hallucinate wage rates, miscalculate overtime, or miss violations. This creates:
1. **Regulatory risk**: Wrong decisions could approve underpayments
2. **Audit risk**: Regulators cannot reproduce LLM reasoning
3. **Trust risk**: Users cannot verify why a decision was made

**Current State**: The system uses `extractWCPTool` and `validateWCPTool` (deterministic) and an LLM agent that produces a decision. However, there's no enforced boundary between what must be deterministic vs. what the LLM can reason about.

---

## Decision

Adopt a **mandatory three-layer decision pipeline**:

```
Layer 1 (Deterministic Scaffold) → Layer 2 (LLM Verdict) → Layer 3 (Trust Score + Human Review)
```

### Layer 1 — Deterministic Scaffold
- **Responsibility**: Extract structured data, look up DBWD rates, run all rule checks
- **Output**: `DeterministicReport` with every check result, regulation citations, DBWD version
- **Constraint**: No AI. Pure code, 100% reproducible, replay-safe

### Layer 2 — LLM Verdict  
- **Responsibility**: Reason over Layer 1 findings, decide Approved/Revise/Reject
- **Input**: `DeterministicReport` + regulatory context
- **Constraint**: **Cannot recompute**. Must reference specific check IDs from Layer 1. Must include reasoning trace.
- **Output**: `LLMVerdict` with status, rationale, referenced check IDs, citations

### Layer 3 — Trust Score + Human Review
- **Responsibility**: Compute hybrid trust score, apply thresholds, flag low-trust for human review
- **Formula**: `trust = 0.35·deterministic + 0.25·classification + 0.20·llmSelf + 0.20·agreement`
- **Thresholds**:
  - `≥0.85`: Auto-decide
  - `0.60–0.85`: Flag for review (advisory)
  - `<0.60`: Require human review (block auto-approval)
- **Output**: `TrustScoredDecision` with full audit trail

### Enforcement
- **Type system**: Only `TrustScoredDecision` can be returned from `generateWcpDecision()`
- **Schema validation**: LLM must provide `referencedCheckIds` (non-empty subset of Layer 1 check IDs)
- **CI lint**: Fail build if LLM is called without prior deterministic report
- **CI test**: Golden-set calibration ensures trust bands correlate with actual correctness

---

## Consequences

### Positive
- **Auditability**: Every decision has deterministic findings + LLM reasoning trace + trust score
- **Reproducibility**: Layer 1 is deterministic; replay produces identical results
- **Regulatory confidence**: LLM cannot hallucinate wage rates or miscalculate overtime
- **Human oversight**: Low-trust cases automatically flagged for review
- **Debugging**: Clear separation of concerns makes failures easier to diagnose

### Negative
- **Complexity**: More moving parts than a single LLM prompt
- **Latency**: 3 sequential stages add overhead (mitigated: layers 1+3 are fast)
- **Maintenance**: Trust formula requires calibration over time
- **Migration**: Existing code must be refactored into layered structure

### Mitigations
- Trust formula weights can be tuned via golden-set evaluation
- All layers are unit-tested independently
- CI gates prevent bypassing the pipeline

---

## Alternatives Considered

### A) Pure LLM (rejected)
Give the LLM raw WCP text + DBWD rates. Let it do extraction, validation, and decision.
- **Rejection reason**: LLMs hallucinate arithmetic and miss edge cases. Not auditable.

### B) LLM + post-hoc validation (rejected)
Let LLM produce decision, then validate its claims against rules.
- **Rejection reason**: Still allows LLM to hallucinate intermediate values; harder to debug.

### C) Fully deterministic (rejected)
No LLM at all. Pure rule engine.
- **Rejection reason**: Cannot handle ambiguous classifications, trade aliases, or nuanced scenarios requiring regulatory interpretation.

### Selected approach
Layer 1 (deterministic facts) + Layer 2 (LLM reasoning over facts) + Layer 3 (trust governance). Combines accuracy with interpretability.

---

## Related Documents

- `docs/architecture/decision-architecture.md` — Full doctrine with examples
- `docs/architecture/trust-scoring.md` — Trust formula and calibration
- `docs/architecture/human-review-workflow.md` — Queue and reviewer UX
- `src/types/decision-pipeline.ts` — Typed contracts
- `docs/compliance/traceability-matrix.md` — Links to regulatory requirements

---

## Compliance Notes

This architecture directly supports:
- **40 U.S.C. § 3142** (prevailing wage): Layer 1 validates exact rates
- **40 U.S.C. § 3702** (overtime): Layer 1 validates 1.5× calculation
- **Copeland Act § 3145** (record keeping): Full audit trail in Layer 3 output

---

**Decision finalized**: Implement across all WCP compliance decision paths.
