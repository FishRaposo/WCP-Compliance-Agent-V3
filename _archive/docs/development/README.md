# Development Guides

Status Label: Implemented

Guides for contributors and developers working on the WCP Compliance Agent.

---

## Quick Links

- [Contributor Guide](./contributor-guide.md) — Workflow, branching, PRs, review checklist
- **Development Environment** — Setup, debugging, troubleshooting
- **How to Add a Check** — Step-by-step for new validation checks
- **How to Add an ADR** — ADR authoring process

---

## Getting Started

New to the project? Start here:

1. [Quick Start](../quick-start.md) — 5-minute setup
2. [Development Environment](./dev-environment.md) — Full environment setup
3. **Current State** — See README and source code for what's implemented
4. [Three-Layer Architecture](../architecture/decision-architecture.md) — How decisions work

---

## Contribution Workflow

```
1. Read contributor-guide.md
2. Set up dev environment
3. Make changes (following ADR-005 constraints)
4. Run tests: npm test
5. Run lint: npm run lint:pipeline
6. Update docs if needed
7. Self-review using checklist
8. Submit PR
```

---

## Key Constraints

Before contributing, understand these architectural constraints:

### Three-Layer Pipeline (ADR-005)

All compliance decisions MUST flow through:
1. **Layer 1** — Deterministic scaffold (extraction, validation)
2. **Layer 2** — LLM verdict (reasoning over findings)
3. **Layer 3** — Trust score + human review

**Never bypass layers.** The `lint:pipeline` script enforces this.

### Health Metrics Preservation

The `TrustScoredDecision.health` object must always include:
- `cycleTime` — Processing time in ms
- `tokenUsage` — LLM tokens consumed
- `validationScore` — Deterministic check score
- `confidence` — Overall confidence from trust.score

### Regulatory Citations

Every check must cite the regulation it enforces:
- Statutes: `40 U.S.C. § 3142(a)`
- CFR: `29 CFR 5.5(a)(3)(i)`

---

## Common Tasks

| Task | Guide |
|------|-------|
| Add new validation check | [how-to-add-check.md](./how-to-add-check.md) |
| Document architecture decision | [how-to-add-adr.md](./how-to-add-adr.md) |
| Debug failing tests | See test output and `npm run test:unit` |
| Update docs after code change | See Maintenance Rule below |

---

## Maintenance Rule

When code changes, update documentation in this order:

1. **README.md** — Update overview
2. **CHANGELOG.md** — Document changes
3. Other docs — Cross-references, examples

---

## Questions?

- **How do I...?** → Check README.md and docs/quick-start.md
- **What's the architecture?** → Read [system-overview.md](../architecture/system-overview.md)
- **Where's the code?** → See `src/` directory and README.md

---

**Last Updated**: 2026-04-17
