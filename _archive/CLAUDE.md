# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **See AGENTS.md** for the complete architecture reference, CI pipeline, testing quirks, and conventions. This file summarizes the most critical points for a new session.

## Commands

```bash
npm run build:backend            # tsc -p tsconfig.backend.json → dist/*.js
npm run build:frontend           # vite build → dist/showcase/
npm run build                    # Both: backend + frontend (required before serving)
npm run serve                    # Start server (set OPENAI_API_KEY=mock for offline)

npm test                         # Build first, then full vitest suite (slow)
npm run test:unit                # Unit tests only — fastest, no build required
npm run test:pipeline            # Critical subset: must pass before any merge
npm run test:coverage            # Coverage report (≥80% line/function gate enforced)
npm run test:calibration         # 100-example golden set — requires a real OPENAI_API_KEY
npm run lint:pipeline            # AST architectural lint — runs in CI, enforces layer isolation

npx vitest run tests/unit/trust-score.test.ts   # Single test file (skips build)
npx vitest run -t "pattern"                      # Single test by name
```

**Key quirk**: `npm test` always rebuilds `src/` first. When only tests changed, run `npx vitest run` directly to skip the build step.

## Architecture

The core is a **three-layer decision pipeline** in `src/pipeline/`. Every WCP compliance decision flows through all three layers in sequence via the orchestrator — bypassing any layer is a CI failure enforced by AST lint.

```
src/entrypoints/wcp-entrypoint.ts  →  src/pipeline/orchestrator.ts
                                           │
                  ┌────────────────────────┼────────────────────────┐
                  ▼                        ▼                        ▼
     layer1-deterministic.ts    layer2-llm-verdict.ts    layer3-trust-score.ts
     (regex extraction,          (LLM reasons over         (computes trust score,
      DBWD rate lookup,           Layer 1 findings;         routes to human review
      8 rule checks)              MUST cite check IDs)      if trust < 0.60)
```

- **Layer 1** is 100% deterministic — no LLM, pure regex/arithmetic/lookup.
- **Layer 2** is FORBIDDEN from recomputing anything Layer 1 already produced. It only interprets.
- **Layer 3** is a pure function (replay-safe). The four trust components and their weights are in `src/pipeline/layer3-trust-score.ts`.
- **Orchestrator** is the only valid entry point. CI will reject any code that calls layers directly.

### Key files to understand before changing the pipeline

| File | Role |
|------|------|
| `src/types/decision-pipeline.ts` | All typed contracts (interfaces + Zod schemas). Change here first. |
| `src/pipeline/orchestrator.ts` | Composes layers; error fallback returns "Pending Human Review". |
| `src/retrieval/hybrid-retriever.ts` | DBWD rate lookup — falls back to 20-trade in-memory corpus when ES/DB unavailable. |
| `src/prompts/versions/wcp-verdict-v2.ts` | Active Layer 2 prompt template. Only one active version exists. |
| `scripts/lint-pipeline-discipline.ts` | AST rules enforcing layer isolation (uses ts-morph). |

### Mock mode

Set `OPENAI_API_KEY` to `mock`, `mock-key`, `test-api-key`, or empty to bypass the OpenAI API entirely. `isMockMode()` in `src/utils/mock-responses.ts` controls this. `tests/setup.ts` sets `OPENAI_API_KEY=test-api-key` automatically for all test runs.

### DBWD retrieval fallback chain

`hybrid-retriever.ts` tries, in order: (1) exact in-memory match → (2) alias match → (3) full ES + pgvector + cross-encoder hybrid → (4) "unknown" fallback. Tiers 1–2 are always available; Tiers 3 requires `ELASTICSEARCH_URL` and `POSTGRES_URL` (Phase 02 infrastructure, optional).

### Deployment

Vercel serverless. Functions live in `api/` (`analyze.ts`, `health.ts`). The demo SPA source is in `src/frontend/`; it builds to `dist/showcase/`. The main Node server (`src/server.ts`) is for local development.

**Local dev:**
```bash
# Terminal 1 — backend
OPENAI_API_KEY=mock node dist/server.js

# Terminal 2 — frontend (proxies /api to localhost:3000)
npx vite
```
