---
description: Validate Phase 3 agent implementation (typecheck + tests + mock E2E)
---

## Prerequisites

- Node.js 20+ installed (`node --version`)
- Agent dependencies installed (`cd agent && npm ci`)
- Backend running on port 8000 OR mock mode used (no backend needed for `npm test`)

---

## Step 1 — Install agent dependencies

```bash
cd agent
npm ci
```

Expected: no errors, `node_modules/` created.

---

## Step 2 — TypeScript type check (0 errors required)

```bash
cd agent
npm run typecheck
```

Expected: `tsc --noEmit` exits 0 with no output.

---

## Step 3 — Run all tests (0 failures required)

```bash
cd agent
npm test
```

Expected output pattern:
```
✓ src/tests/unit/schemas.test.ts        (5 tests)
✓ src/tests/unit/trust-score.test.ts    (5 tests)
✓ src/tests/unit/prompts.test.ts        (6 tests)
✓ src/tests/unit/tools.test.ts          (5 tests)
✓ src/tests/unit/rate_limiter.test.ts   (3 tests)
✓ src/tests/integration/pipeline.test.ts (3 tests)

Test Files  6 passed
Tests      27+ passed
```

The mock Python backend (port 9999) is started automatically via `vitest.config.ts` globalSetup.
No real backend or OpenAI key is required.

---

## Step 4 — Mock-mode E2E (Phase 3 exit gate)

```bash
cd agent
LLM_MODE=mock OPENAI_API_KEY=mock AUTH_DISABLED=true npm run dev &
sleep 3

curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "Role: Electrician, Hours: 40, Wage: 51.69, Fringe: 34.63"}'
```

Expected: JSON response containing:
```json
{
  "job_id": "...",
  "verdict": "approved" | "rejected" | "requires_review",
  "trust_score": 0.0-1.0,
  "trust_band": "auto_approve" | "flag_for_review" | "require_human_review",
  "requires_human_review": true | false,
  "reasoning_summary": "...",
  "citations": [...]
}
```

**Do not proceed to Phase 4 until this returns a valid TrustScoredDecision.**

---

## Step 5 — Backend auth migration (one-time, needs Postgres)

```bash
cd backend
poetry run alembic upgrade 005
```

This creates the `users` table for JWT auth. Already included in `alembic upgrade head`.

---

## Step 6 — Backend unit tests (auth + all prior tests)

```bash
cd backend
poetry run pytest tests/unit -v
```

Expected: 120+ tests passing including `test_auth.py`.

---

## Exit Criteria Checklist

- [ ] `npm run typecheck` → 0 errors
- [ ] `npm test` → 0 failures, 27+ tests pass
- [ ] Mock-mode E2E → valid `TrustScoredDecision` returned
- [ ] `poetry run pytest tests/unit -v` → 120+ passing
- [ ] Migration 005 applies cleanly (`alembic upgrade 005`)
