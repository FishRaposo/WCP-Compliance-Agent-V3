# AGENTS.md

## Architecture: Three-Layer Decision Pipeline

Every compliance decision flows through exactly three layers. Bypassing any layer is a CI failure.

```
Layer 1 (Deterministic) → Layer 2 (LLM Verdict) → Layer 3 (Trust Score)
```

- **Layer 1** (`src/pipeline/layer1-deterministic.ts`): Extraction (11 fields), DBWD rate lookup via hybrid retriever, rule checks. Pure deterministic code, no LLM.
- **Layer 2** (`src/pipeline/layer2-llm-verdict.ts`): LLM reasons over Layer 1 findings. FORBIDDEN from recomputing arithmetic or re-looking up rates. Must cite check IDs.
- **Layer 3** (`src/pipeline/layer3-trust-score.ts`): Computes trust score, flags for human review if score < 0.60.
- **Orchestrator** (`src/pipeline/orchestrator.ts`): The ONLY valid path through all three layers. Called by `src/entrypoints/wcp-entrypoint.ts`.

The pipeline discipline lint (`npm run lint:pipeline`) uses ts-morph AST analysis to enforce:
1. `Agent.generate()` can only be called in `src/pipeline/layer2-llm-verdict.ts`
2. `generateWcpDecision` must return `TrustScoredDecision`
3. Orchestrator must use `executeDecisionPipeline`
4. Layer 2 must call `validateReferencedCheckIds`

## Commands

```bash
npm install              # Install dependencies (root only — no sub-packages)
npm run build            # build:backend (tsc) + build:frontend (vite) → dist/
npm run build:backend    # tsc -p tsconfig.backend.json → dist/*.js
npm run build:frontend   # vite build → dist/showcase/
npm run serve            # Start built server (dist/server.js)

npm test                 # Build first, then vitest run (slow: includes build)
npm run test:unit        # Unit tests only (vitest run tests/unit)
npm run test:integration # Integration tests only
npm run test:pipeline    # Pipeline-specific tests (unit + integration for pipeline)
npm run test:calibration # Trust calibration golden set — 100 examples (verbose output)
npm run test:coverage    # Coverage report
npm run test:retrieval   # Retrieval module tests (hybrid-retriever, RRF — no infra required)
npm run test:frontend    # Frontend component tests (jsdom, vitest.config.frontend.ts)

npm run lint:pipeline    # AST-based architectural lint (runs in CI)
npm run lint:frontend    # ESLint for src/frontend/
```

**Key quirk**: `npm test` runs `npm run build` before vitest. If you only changed tests (not src), you can run `vitest run` directly to skip the build.

**Single test file**: `npx vitest run tests/unit/trust-score.test.ts`

**Single test by name**: `npx vitest run -t "test name pattern"`

## Environment

- `OPENAI_API_KEY` is required. Set to `"mock"`, `"mock-key"`, `"test-api-key"`, or empty for offline development/testing (triggers mock mode via `isMockMode()` in `src/utils/mock-responses.ts`).
- Optional: `OPENAI_MODEL` (default: `gpt-4o-mini`), `AGENT_MAX_STEPS` (default: `3`).
- Phase 02: `ELASTICSEARCH_URL` (default: `http://localhost:9200`), `ELASTICSEARCH_INDEX` (default: `dbwd_corpus`), `POSTGRES_URL`, `EMBEDDING_MODEL` (default: `text-embedding-3-small`), `PGVECTOR_DIMENSIONS` (default: `1536`).
- `src/utils/env-validator.ts` loads `.env` via dotenv and fails fast if `OPENAI_API_KEY` is missing.
- `tests/setup.ts` sets `OPENAI_API_KEY=test-api-key` and `NODE_ENV=test` for all tests.
- All retrieval infrastructure is optional: hybrid-retriever falls back to in-memory corpus when ES/DB are unavailable.

## Testing Quirks

- Tests require `OPENAI_API_KEY` to be set (tests/setup.ts handles this).
- Layer 2 tests use mock mode automatically when key is `"test-api-key"` or `"mock"`.
- Pipeline tests (`npm run test:pipeline`) are the critical subset that must always pass before merge.
- Trust calibration tests (`tests/eval/trust-calibration.test.ts`) run against a golden set and may need real API keys in CI (set `OPENAI_API_KEY` to a real key, not a mock value).
- Coverage thresholds: 80% lines, 70% branches, 80% functions, 80% statements. `src/retrieval/vector-search.ts` and `src/services/db-client.ts` are excluded from coverage (tested separately).

## CI (GitHub Actions)

Workflow: `.github/workflows/pipeline-discipline.yml`. Runs on push/PR to main/develop. Node 20.

Sequential stages:
1. **Build** — `npm run build`
2. **Pipeline lint** — `npm run lint:pipeline` (parallel with unit/retrieval)
3. **Unit tests** — `npm run test:unit` (mock mode)
4. **Retrieval tests** — `npm run test:retrieval` (mock mode)
5. **Pipeline tests** — `npm run test:pipeline` (must pass before coverage/calibration)
6. **Coverage** — `npm run test:coverage` (≥80% gate)
7. **Trust calibration** — `npm run test:calibration` (100-example golden set, needs real `OPENAI_API_KEY`, only on main or when `ENABLE_CALIBRATION=true`)

## Conventions

- ES modules (`"type": "module"` in package.json). Use `.js` extensions in imports.
- Strict TypeScript (`"strict": true`). No `any` without justification.
- Path alias `@` maps to `./src` in vitest config.
- Commit messages: `<type>: <subject>` (feat, fix, docs, test, refactor, ci).
- Branches: `feature/*`, `fix/*`, `docs/*` — see `.github/CONTRIBUTING.md` for full checklist.
- `require.main === module` in `scripts/lint-pipeline-discipline.ts` will not work with ESM — this is a known issue, the script works via `npx tsx` invocation.
- DBWD rates: Layer 1 delegates lookups to `src/retrieval/hybrid-retriever.ts`. Falls back to 20-trade in-memory corpus when ES/DB unavailable (default for demo).
- `ExtractedWCP` has 11 fields (workerName, socialSecurityLast4, tradeCode, localityCode, hoursByDay, grossPay — per WH-347 form).
- Prompt registry in `src/prompts/` — v2 is the only active template. Override per org via `orgId`.
- Golden set: 100 labeled examples in `tests/eval/golden-set.ts`.

## Decision Contracts (`src/types/`)

The central type is `TrustScoredDecision` in `src/types/decision-pipeline.ts`. Key fields:
- `deterministic`: Layer 1 report (extracted data, checks, DBWD rate, score)
- `verdict`: Layer 2 output (status, rationale, referencedCheckIds, reasoning trace)
- `trust`: Layer 3 score (components: deterministic, classification, llmSelf, agreement; band: auto/require_human)
- `humanReview`: required flag, status, queuedAt
- `auditTrail`: array of timestamped events from each layer
- `finalStatus`: "Approved" | "Revise" | "Reject" | "Pending Human Review"

`validateReferencedCheckIds()` ensures every check ID cited by the LLM actually exists in the Layer 1 report.

## Repository Layout

```
src/
  pipeline/         # Three-layer decision pipeline (backend)
  retrieval/        # Hybrid BM25+vector retriever
  prompts/          # Prompt registry + v2 template
  services/         # DB client, human-review queue
  utils/            # Env validation, mock responses, errors
  config/           # App, agent, DB config
  entrypoints/      # wcp-entrypoint.ts (public API)
  frontend/         # React SPA (Vite + TailwindCSS)
api/                # Vercel serverless functions (analyze.ts, health.ts)
tests/              # Backend unit + integration + eval tests
dist/               # Build output
  *.js              # Backend (tsc output)
  showcase/         # Frontend (vite output → dist/showcase/)
public/             # Static assets (favicon.svg, icons.svg)
index.html          # Vite entry point
```

**Local dev:**
```bash
# Backend
OPENAI_API_KEY=mock node dist/server.js

# Frontend (proxies /api to localhost:3000)
npx vite
```


