# ADR-004: Testing Strategy (Vitest + Future Playwright)

Status: Accepted

Date: April 2026

## Context

The WCP Compliance Agent makes binding compliance decisions under the Davis-Bacon Act (40 U.S.C. § 3142). Incorrect decisions — particularly false approvals of underpaid payrolls — carry regulatory liability. The testing strategy must therefore:

1. Verify deterministic arithmetic with high confidence (unit tests)
2. Catch integration regressions across all three pipeline layers
3. Enforce architectural constraints at commit time (not just at runtime)
4. Provide a calibration gate that measures real-world decision quality
5. Be fast enough to run in CI on every push

The project has no web UI in Phase 01, so browser-based E2E testing is premature.

A secondary concern is developer ergonomics: the test suite must work offline (mock mode) so no API key is required for routine development.

## Decision

Adopt **Vitest** as the primary and sole test runner for Phase 01, with four distinct testing tiers:

| Tier | Command | Scope | Runs In |
|------|---------|-------|---------|
| Unit | `npm run test:unit` | Isolated functions and modules | Mock mode (no API key) |
| Integration | `npm run test:integration` | Full pipeline with mock LLM | Mock mode (no API key) |
| Pipeline discipline | `npm run lint:pipeline` | AST architectural enforcement | Build-time, no runtime |
| Trust calibration | `npm run test:calibration` | Golden-set regression gate | Requires real `OPENAI_API_KEY` |

Coverage is enforced via `npm run test:coverage` (excludes calibration) with the following thresholds:
- **Lines**: ≥ 80%
- **Branches**: ≥ 70%
- **Functions**: ≥ 80%
- **Statements**: ≥ 80%

### Testing Hierarchy

```
                    ┌─────────────────────────────────┐
                    │   Trust Calibration (eval/)      │  ← Real API key, CI only
                    │   22 golden examples             │    >95% detection rate
                    │   npm run test:calibration       │    <2% false-approve
                    └─────────────────────────────────┘
                    ┌─────────────────────────────────┐
                    │   Integration Tests              │  ← Mock mode, all devs
                    │   Full pipeline E2E              │    decision-pipeline.test.ts
                    │   npm run test:integration       │
                    └─────────────────────────────────┘
                    ┌─────────────────────────────────┐
                    │   Unit Tests                     │  ← Mock mode, all devs
                    │   Layer 1, 2, 3 + contracts      │    trust-score.test.ts
                    │   npm run test:unit              │    pipeline-contracts.test.ts
                    └─────────────────────────────────┘
                    ┌─────────────────────────────────┐
                    │   Pipeline Discipline Lint       │  ← Pure AST, no execution
                    │   Architectural constraints      │    lint-pipeline-discipline.ts
                    │   npm run lint:pipeline          │    ts-morph based
                    └─────────────────────────────────┘
```

### Mock Mode

All tests that involve LLM calls use mock mode detection via `isMockMode()` in `src/utils/mock-responses.ts`. When `OPENAI_API_KEY` is `"mock"`, `"mock-key"`, or `"test-api-key"`, the LLM layer returns deterministic mock responses. This allows the full pipeline to run without API costs.

The test setup file (`tests/setup.ts`) sets `OPENAI_API_KEY=test-api-key` and `NODE_ENV=test` for all tests.

### Pipeline Discipline Lint

The architectural lint at `scripts/lint-pipeline-discipline.ts` uses ts-morph AST analysis to enforce four invariants at every commit:

1. `Agent.generate()` can only be called in `src/pipeline/layer2-llm-verdict.ts`
2. `generateWcpDecision` must return `TrustScoredDecision`
3. Orchestrator must use `executeDecisionPipeline`
4. Layer 2 must call `validateReferencedCheckIds`

This catches structural violations before they reach the test suite.

## Consequences

### Positive

- **TypeScript-native**: Vitest runs `.ts` files natively — no compilation step needed for tests
- **Fast feedback**: Unit tests complete in <2s; integration in <5s
- **Offline capable**: All development-critical tests run in mock mode — no API key required
- **Architecture-safe**: Pipeline lint catches forbidden patterns without runtime cost
- **Mock-safe**: Mock mode detection prevents accidental live LLM calls in development

### Negative

- **No browser testing**: Playwright is deferred — any web UI bugs will be caught only by manual testing until Phase 03
- **Calibration requires real key**: The quality gate (`test:calibration`) cannot run in forks or offline — it depends on a real `OPENAI_API_KEY` CI secret

### Risks

- **Calibration tests fail in mock mode**: This is expected and intentional. The calibration tests are guarded by a real API key requirement in CI. If the key is missing, tests gracefully skip or produce lower accuracy (acceptable in dev).
- **Coverage excludes server entrypoints**: `app.ts`, `server.ts`, and `index.ts` are HTTP server bootstrap files that require a running server to test. Excluded from coverage metrics (acceptable — these files have no business logic).

## Alternatives Considered

### Jest

**Description**: The most widely used JavaScript test runner. Works with TypeScript via `ts-jest` or Babel transforms.

**Verdict**: Rejected — ESM configuration complexity with our `"type": "module"` package is significant. Vitest has better native ESM support and TypeScript integration.

### Mocha + Chai

**Description**: Traditional test runner + assertion library combination.

**Verdict**: Rejected — Requires additional tooling for TypeScript, coverage, and mocking. Less cohesive ecosystem than Vitest.

### Playwright (Phase 01)

**Description**: Browser automation framework used for E2E testing of web UIs.

**Verdict**: Deferred to Phase 03 — There is no web UI in Phase 01. Adding Playwright now would add maintenance cost for zero benefit.

### Separate coverage thresholds per file

**Description**: Enforce file-level coverage thresholds rather than aggregate.

**Verdict**: Rejected for Phase 01 — Aggregate thresholds are simpler and sufficient. File-level thresholds can be added in Phase 02 after the codebase stabilizes.

## Implementation

### Test Files

```
tests/
├── setup.ts                          # Global test setup (env vars)
├── unit/
│   ├── pipeline-contracts.test.ts    # Layer contracts and types (29 tests)
│   ├── trust-score.test.ts           # Trust formula and thresholds (37 tests)
│   ├── test_wcp_tools.test.ts        # Mastra tools (9 tests)
│   ├── env-validator.test.ts         # Environment validation (17 tests)
│   ├── agent-config.test.ts          # Agent config (11 tests)
│   ├── app-config.test.ts            # App config (20 tests)
│   ├── db-config.test.ts             # Database config (9 tests)
│   ├── errors.test.ts                # Error classes and utilities (46 tests)
│   └── human-review-queue.test.ts    # Review queue service (24 tests)
├── integration/
│   ├── decision-pipeline.test.ts     # Full pipeline integration (35 tests)
│   └── test_wcp_integration.test.ts  # Legacy integration (1 test)
└── eval/
    └── trust-calibration.test.ts     # Golden set calibration (13 tests)
```

### Coverage Configuration

```typescript
// vitest.config.ts
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  thresholds: {
    lines: 80,
    branches: 70,
    functions: 80,
    statements: 80
  }
}
```

### CI Integration

All tiers run in GitHub Actions (`.github/workflows/pipeline-discipline.yml`):

```
build → pipeline-lint → unit-tests → pipeline-tests → calibration (with secret)
                                   → coverage gate (≥80%)
```

## Planned (Phase 03)

When a web UI is built in Phase 03 (Showcase), add Playwright for:

- **End-to-end submission flows**: Submit a WCP through the UI and verify the decision
- **Decision display verification**: Confirm audit trail, trust score, and findings are rendered correctly
- **Accessibility testing**: Ensure compliance with WCAG 2.1 AA for accessibility compliance (ironic given the domain)
- **Mobile responsiveness**: Verify demo UI works on mobile devices for recruiter demos

Playwright would run as an additional CI stage after the existing pipeline-discipline stages.

## Status

- **Proposed**: April 2026
- **Accepted**: April 2026
- **Last reviewed**: April 2026

## References

- `tests/` — test file structure
- `vitest.config.ts` — coverage configuration
- `scripts/lint-pipeline-discipline.ts` — AST architectural lint
- `src/utils/mock-responses.ts` — mock mode detection
- `tests/setup.ts` — global test setup
- `.github/workflows/pipeline-discipline.yml` — CI workflow
