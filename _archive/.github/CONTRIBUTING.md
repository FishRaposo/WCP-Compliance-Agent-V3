# Contributing Guidelines

Self-review checklist for solo development with AI assistance.

---

## Decision Architecture Rules (Mandatory)

Every compliance decision MUST follow the **Three-Layer Pipeline**:

```
Layer 1 (Deterministic Scaffold) → Layer 2 (LLM Verdict) → Layer 3 (Trust Score + Human Review)
```

### ✅ DO

- **Layer 1**: Use deterministic tools for extraction, DBWD lookup, and rule checks
- **Layer 2**: Pass `DeterministicReport` to LLM; LLM reasons over pre-computed findings
- **Layer 3**: Compute trust score, apply thresholds, enqueue low-trust for human review
- Return **only** `TrustScoredDecision` from `generateWcpDecision()`
- Include full `auditTrail` with every stage
- Add `referencedCheckIds` to LLM verdict (non-empty, valid IDs)

### ❌ DON'T

- Call LLM without first running deterministic checks
- Allow LLM to do arithmetic or recompute wages/overtime
- Return raw `WCPDecision` without trust scoring
- Skip human review queue for low-trust (`< 0.60`) cases
- Bypass the pipeline via direct `agent.generate()` calls

### Code Review Checklist

Before submitting any PR:
- [ ] All deterministic checks have regulation citations (40 U.S.C., 29 CFR)
- [ ] LLM verdict includes `referencedCheckIds` (validated at runtime)
- [ ] Trust score computed using the weighted formula
- [ ] Low-trust (`< 0.60`) or disagreement cases enqueue to `humanReviewQueue`
- [ ] `auditTrail` includes Layer 1, Layer 2, and Layer 3 events
- [ ] `npm run lint:pipeline` passes (no bypassing pipeline)
- [ ] `npm run test:trust-calibration` passes (golden set accuracy)
- [ ] Mock mode works without OpenAI key

### Enforcement

CI will fail if:
1. `Agent.generate()` called outside `src/pipeline/layer2-llm-verdict.ts`
2. Decision returns without trust score
3. Low-trust decision skips human review flagging

See `docs/architecture/decision-architecture.md` for full doctrine.

---

## Branching Strategy

| Branch | Purpose | Naming |
|--------|---------|--------|
| `main` | Production-ready code | — |
| `feature/*` | New capabilities | `feature/phase-02-retrieval` |
| `fix/*` | Bug fixes | `fix/trust-score-calculation` |
| `docs/*` | Documentation only | `docs/decision-architecture` |

---

## Commit Message Convention

```
<type>: <subject>

<body>
```

**Types**:
- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation
- `test:` — Tests
- `refactor:` — Code restructuring
- `ci:` — CI/CD changes

**Examples**:
```
feat: implement layer3 trust scoring with human review queue

- Add computeTrustScore() with 4-component formula
- Enqueue decisions with trust < 0.60 for human review
- Include agreement check override

docs: add decision architecture doctrine

- Three-layer pipeline documentation
- Correct vs incorrect code examples
- Enforcement checklist
```

---

## Documentation Triggers

Update docs when:
- New architecture pattern introduced
- Trust weights or thresholds changed
- Pipeline layer modified
- Public API changes
- Evaluation strategy changes
- Regulation coverage expanded

**Required doc updates**:
1. `docs/architecture/decision-architecture.md` — If pipeline structure changes
2. `docs/architecture/trust-scoring.md` — If formula or thresholds change
3. `docs/adrs/` — If architectural decision modified
4. `docs/INDEX.md` + `README.md` — Cross-references

---

## Testing Requirements

### Unit Tests

Every new function requires:
- Happy path test
- Error path test
- Edge case test

```typescript
// tests/unit/trust-score.test.ts
describe("computeTrustScore", () => {
  it("returns auto band for high trust", () => { ... });
  it("returns require_human for disagreement", () => { ... });
  it("handles zero checks gracefully", () => { ... });
});
```

### Integration Tests

Every pipeline change requires:
- End-to-end flow test
- Mock mode verification
- Error recovery test

### Calibration Tests

Trust formula changes require:
- Golden set re-run
- Accuracy metrics within targets
- Documented threshold rationale

---

## Self-Review Checklist

Before merging:
- [ ] `npm test` passes
- [ ] `npm run build` compiles without errors
- [ ] `npm run lint:pipeline` passes
- [ ] `npm run test:trust-calibration` passes
- [ ] Documentation updated
- [ ] `TODO.md` updated if tasks completed
- [ ] ADR created if architectural decision made
- [ ] Commit messages follow convention
- [ ] No secrets in code

---

## Decision Architecture References

- `docs/adrs/ADR-005-decision-architecture.md` — Original decision record
- `docs/architecture/decision-architecture.md` — Full doctrine
- `docs/architecture/trust-scoring.md` — Trust formula
- `docs/architecture/human-review-workflow.md` — Review queue
- `src/types/decision-pipeline.ts` — Typed contracts
