# Architecture Decision Records (ADRs)

Status Label: Implemented

This directory contains Architecture Decision Records (ADRs) for the WCP Compliance Agent. Each ADR captures a significant architectural decision, its context, and its consequences.

---

## ADR Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [ADR-001](ADR-001-mastra-over-langchain.md) | Mastra over LangChain | ✅ Accepted | Jan 2024 |
| [ADR-002](ADR-002-hybrid-retrieval.md) | Hybrid Retrieval (BM25 + Vector + Rerank) | ✅ Accepted | Jan 2024 |
| [ADR-003](ADR-003-deterministic-validation.md) | Deterministic Validation Layer | ✅ Accepted | Jan 2024 |
| [ADR-004](ADR-004-testing-strategy.md) | Testing Strategy (Vitest + Future Playwright) | ✅ Accepted | Apr 2026 |
| [ADR-005](ADR-005-decision-architecture.md) | Three-Layer Decision Architecture | ✅ Accepted | Apr 2026 |

---

## Quick Reference

### By Implementation Status

**Implemented (with real data)**
- ADR-001: Mastra framework (in use in `src/`)
- ADR-004: Testing strategy (Vitest + calibration tests, ≥80% coverage enforced)
- ADR-005: Three-layer pipeline structure (in use in `src/pipeline/`)

**Structurally Implemented, Data Stubbed**
- ADR-003: Deterministic validation (uses hardcoded DBWD rates)

**Designed / Target (not yet implemented)**
- ADR-002: Hybrid retrieval (documented, stubbed)

---

## ADR Template

When creating a new ADR, use this structure:

```markdown
# ADR-XXX: [Title]

Status: [Proposed / Accepted / Deprecated / Superseded by ADR-YYY]

Date: [Month Year]

## Context

[What is the problem we're solving? What are the forces at play?]

## Decision

[What did we decide? Be specific.]

## Consequences

### Positive
- [...]

### Negative
- [...]

### Risks
- [...]

## Alternatives Considered

### [Option A]
[Description]

**Verdict**: [Accepted/Rejected] — [Reason]

### [Option B]
[Description]

**Verdict**: [Accepted/Rejected] — [Reason]

## Implementation

[Code examples, file references]

## Status

- **Proposed**: [Date]
- **Accepted**: [Date]
- **Last reviewed**: [Date]
```

---

## How to Propose a New ADR

1. **Copy this template** to a new file: `ADR-XXX-short-title.md`
2. **Fill in Context** — explain the problem clearly
3. **Document the Decision** — be specific about what was decided
4. **List Consequences** — both positive and negative
5. **Describe Alternatives** — what was considered and rejected
6. **Submit for review** — in a PR with the "adr" label
7. **Update this README** — add to the index table

---

## ADR Lifecycle

```
Proposed → Accepted → Implemented → [Deprecated/Superseded]
   ↓           ↓           ↓
  PR       Merged      Code exists
  Review   to main     and works
```

### Status Definitions

- **Proposed**: Under discussion, not yet decided
- **Accepted**: Decision made, ready for implementation
- **Implemented**: Code exists and matches the ADR
- **Deprecated**: Decision no longer applies, but code may remain
- **Superseded**: Replaced by a newer ADR (link to it)

---

## Cross-References

- [Decision Architecture Doctrine](../architecture/decision-architecture.md)

---

**Last Updated**: 2026-04-17
