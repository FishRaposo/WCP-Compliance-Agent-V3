# AGENTS.md

## Three-Service Architecture

V3 is a polyglot system — three independent services, each with its own package manager and commands. There is no root `package.json` or monorepo tool.

| Service | Stack | Port | Package Manager |
|---|---|---|---|
| **backend** | Python 3.12, FastAPI, Celery, asyncpg | 8000 | Poetry |
| **agent** | TypeScript, Hono, Mastra.ai, Vercel AI SDK | 3000 | npm |
| **frontend** | React 19, Vite, Tailwind, Shadcn/ui | 5173 | npm |

Data layer: PostgreSQL 16 (pgvector), Redis 7, Elasticsearch 8, Arize Phoenix.

## Commands

**Always `cd` into the service directory before running commands.** Each service is independent.

### Backend (Python)

```bash
cd backend
poetry install                              # Install deps
poetry run uvicorn wcp_backend.main:app --reload  # Dev server
poetry run pytest tests/unit -v             # Unit tests (no infra needed)
poetry run pytest tests/integration -v      # Needs postgres + redis
poetry run pytest tests/eval/ --benchmark-only  # Golden set (needs full stack + real OPENAI_API_KEY)
poetry run ruff check .                     # Lint
poetry run mypy src/                        # Typecheck (strict mode)
poetry run alembic upgrade head             # Run migrations
```

**Seeding** (required before full pipeline or eval):
```bash
poetry run python scripts/seed_dbwd.py           # DBWD prevailing wage rates
poetry run python scripts/seed_elasticsearch.py   # Regulation chunks → ES
poetry run python scripts/seed_vectors.py         # Embeddings → pgvector
```

### Agent (TypeScript)

```bash
cd agent
npm ci                   # Install (use ci, not install, for lockfile fidelity)
npm run dev              # Dev server (tsx watch)
npm run typecheck        # tsc --noEmit
npm test                 # vitest run
npm run lint             # eslint src
npm run build            # tsc + esbuild → dist/server.js (single bundle)
```

### Frontend (React)

```bash
cd frontend
npm ci
npm run dev              # Vite dev server
npm run typecheck        # tsc --noEmit
npm run build            # tsc -b && vite build
npm run lint             # eslint
```

## CI Workflows

**`.github/workflows/ci.yml`** — runs on push to main/develop and PRs to main. Three parallel jobs, one per service:
- **backend**: Poetry install → `pytest tests/unit -v` (no infra required)
- **agent**: `npm ci` → `npm run typecheck` → `npm test`
- **frontend**: `npm ci` → `npm run typecheck` → `npm run build`

Integration tests and eval tests run locally against WSL-native infrastructure.

**`.github/workflows/deploy.yml`** — frontend → Vercel, backend/agent → Render (via deploy hooks). Runs on push to main.

## Testing Quirks

- **pytest markers**: `unit`, `integration`, `eval`, `benchmark` — use `-m marker` to filter.
- **asyncio_mode = auto** — all async test functions run automatically, no `@pytest.mark.asyncio` needed.
- **Eval tests need real infra**: postgres, redis, ES seeded with DBWD data, and a real `OPENAI_API_KEY`. Don't run them locally without the full stack.
- **conftest.py** provides `client` (FastAPI TestClient), `sample_extracted_wcp`, and `sample_dbwd_rate` fixtures.
- **Agent tests**: vitest, no special infra requirements.
- **Frontend**: no test script in package.json yet — testing-library deps exist but tests are not wired up.

## Environment

- Copy `.env.example` to each service directory or set vars in shell.
- **Mock mode**: set `OPENAI_API_KEY=mock` to skip real LLM calls (agent returns deterministic responses).
- **Backend config**: `pydantic-settings` reads `.env` via `wcp_backend.config.Settings`. Fails fast on missing required vars.
- **Agent config**: uses `dotenv` to load `.env`.
- **Frontend**: Vite env vars prefixed with `VITE_`. `VITE_API_URL` points to agent (default `http://localhost:3000`). Vite dev server proxies `/api` → agent.

## Key Architecture Facts

- **Agent calls backend via REST** — `BACKEND_URL` env var (default `http://localhost:8000`).
- **Backend does all deterministic work** — extraction, validation, rule checks, trust scores, DBWD lookups, RAG. Agent handles LLM reasoning and orchestration only.
- **Shared JSON schemas** in `shared/schemas/` define cross-service contracts. Codegen (`shared/generate.py`) is TODO — schemas are hand-implemented in both `backend/src/wcp_backend/models/` (Pydantic) and `agent/src/types/` (Zod).
- **Celery** processes async batch jobs and eval runs. Worker + beat + flower all run from same `wcp_backend.workers.celery_worker` module.
- **Alembic migrations** in `backend/migrations/` — run with `poetry run alembic upgrade head`. DATABASE_URL must be set.
- **ES single-node yellow status is normal** — no replica shards, system works fine.

## Conventions

- **Backend**: ruff line-length 100, Python 3.12 target, mypy strict. Pydantic v2 everywhere.
- **Agent**: ES modules (`"type": "module"`), Node 20+, strict TypeScript. Builds to single esbuild bundle.
- **Frontend**: `@` path alias → `./src`. TanStack Query for server state, React state for UI.
- **No root-level lint/test/build** — always run commands per-service.

## Phase 3 Launch Checklist

Before deploying to production, complete all items below:

### Configuration
- [ ] Set `LLM_MODE=real` in agent environment (mock mode is blocked in production)
- [ ] Provide valid `OPENAI_API_KEY` (not `mock`)
- [ ] Set strong `JWT_SECRET` (minimum 32 random characters)
- [ ] Set `AUTH_DISABLED=false` (or remove the variable)
- [ ] Configure `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` for observability
- [ ] Configure `SAM_GOV_API_KEY` if live DBWD rate lookups are required

### Database
- [ ] Run `poetry run alembic upgrade head` to apply all migrations (including users table)
- [ ] Create at least one admin user in the `users` table:
  ```python
  import bcrypt
  from sqlalchemy import text
  hashed = bcrypt.hashpw(b"your-password", bcrypt.gensalt()).decode()
  # INSERT INTO users (email, password_hash, role) VALUES ('admin@example.com', hashed, 'admin')
  ```

### Eval Baseline
- [ ] Seed DBWD data: `poetry run python scripts/seed_dbwd.py`
- [ ] Seed Elasticsearch: `poetry run python scripts/seed_elasticsearch.py`
- [ ] Seed vectors: `poetry run python scripts/seed_vectors.py`
- [ ] Run full eval with real OpenAI key: `poetry run pytest tests/eval/ -v`
- [ ] Save baseline: copy `eval_report.json` to `tests/eval/baseline_scores.json`
- [ ] Verify no regressions: `poetry run python tests/eval/regression_test.py`

### Smoke Tests
- [ ] All three services start without errors (backend, agent, frontend)
- [ ] Backend health: `curl http://localhost:8000/health`
- [ ] Agent health: `curl http://localhost:3000/health`
- [ ] Frontend loads: `http://localhost:5173` shows login page
- [ ] Login flow works: POST `/api/auth/login` returns JWT
- [ ] Analyze flow works: POST `/api/analyze` returns TrustScoredDecision
- [ ] SSE stream works: `curl http://localhost:3000/api/decisions/stream`

### Post-Launch
- [ ] Monitor Langfuse for LLM cost and latency trends
- [ ] Monitor Phoenix for trace coverage
- [ ] Set up alerts for trust score drops below 0.60
- [ ] Schedule weekly eval runs to catch regression

## Auth Setup (Development)

For local development with auth enabled:

1. Run migration 005 to create the `users` table:
   ```bash
   cd backend
   poetry run alembic upgrade 005
   ```

2. Create a test user (run in Python shell or script):
   ```python
   import bcrypt
   hashed = bcrypt.hashpw(b"password", bcrypt.gensalt()).decode()
   # INSERT INTO users (email, password_hash, role) VALUES ('dev@example.com', hashed, 'admin')
   ```

3. In agent `.env`, set:
   ```
   JWT_SECRET=dev-secret-change-before-launch
   AUTH_DISABLED=false
   ```

4. Log in via frontend at `http://localhost:5173/login`

To disable auth during development:
```
AUTH_DISABLED=true
```

## Mock Mode Removal

**Mock LLM mode is development/CI only.** Before launch:

1. Set `LLM_MODE=real`
2. Provide a valid `OPENAI_API_KEY`
3. Verify `generateObject` calls succeed with real model
4. Run golden set eval to establish real LLM baseline
5. Remove or gate any `isMockMode` branches that should not run in production

The agent config throws a hard error on startup if `NODE_ENV=production` and `LLM_MODE=mock`.

