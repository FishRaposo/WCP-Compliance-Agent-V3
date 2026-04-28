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

**Mock mode** (no backend/agent needed):
```bash
VITE_MOCK_API=true npm run dev   # All API calls return fixture data
```
Or create `frontend/.env.local` with `VITE_MOCK_API=true`.

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
- **Frontend**: no test script in package.json yet — testing-library deps exist but tests are not wired up. Build verification: `npm run typecheck && npm run build`.

## Environment

- Copy `.env.example` to each service directory or set vars in shell.
- **Mock mode**: set `LLM_MODE=mock` to skip real LLM calls (agent returns deterministic responses).
- **Backend config**: `pydantic-settings` reads `.env` via `wcp_backend.config.Settings`. Fails fast on missing required vars.
- **Agent config**: uses `dotenv` to load `.env`. Multi-LLM routing controlled by `LLM_PROVIDER` (openai|anthropic|ollama).
- **Frontend**: Vite env vars prefixed with `VITE_`. `VITE_API_URL` points to agent (default `http://localhost:3000`). Vite dev server proxies `/api` → agent. Set `VITE_MOCK_API=true` for standalone frontend development with fixture data.

## Key Architecture Facts

- **Agent calls backend via REST** — `BACKEND_URL` env var (default `http://localhost:8000`).
- **Backend does all deterministic work** — extraction, validation, rule checks, trust scores, DBWD lookups, RAG. Agent handles LLM reasoning and orchestration only.
- **Shared JSON schemas** in `shared/schemas/` define cross-service contracts. Codegen (`python shared/generate.py`) produces `backend/src/wcp_backend/models/_generated.py` (Pydantic) and `agent/src/types/_generated.ts` (Zod). Hand-written models in each service take precedence.
- **Celery** processes async batch jobs and eval runs. Worker + beat + flower all run from same `wcp_backend.workers.celery_worker` module.
- **Alembic migrations** in `backend/migrations/` — run with `poetry run alembic upgrade head`. DATABASE_URL must be set.
- **ES single-node yellow status is normal** — no replica shards, system works fine.
- **Multi-LLM routing (V3.1):** `agent/src/lib/llm-router.ts` selects provider based on context (compliance-critical → OpenAI, cost mode → Ollama, synthesis → Anthropic). Falls back through chain on failure. Compliance-critical decisions never use Ollama.
- **Baseline regression scores** in `backend/tests/eval/baseline_scores.json`. Regenerate with `poetry run python scripts/generate_baseline.py`.

## Conventions

- **Backend**: ruff line-length 100, Python 3.12 target, mypy strict. Pydantic v2 everywhere.
- **Agent**: ES modules (`"type": "module"`), Node 20+, strict TypeScript. Builds to single esbuild bundle.
- **Frontend**: `@` path alias → `./src`. TanStack Query for server state, React state for UI.
- **No root-level lint/test/build** — always run commands per-service.

## Production Launch Checklist

Before deploying V3.1 to production, complete all items below:

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
- [ ] Generate baseline: `poetry run python scripts/generate_baseline.py`
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

## Repository Structure

OSS scaffold files at the repo root:

| File | Purpose |
|---|---|
| `LICENSE` | MIT license |
| `CONTRIBUTING.md` | How to contribute, dev setup, code style |
| `SECURITY.md` | Security policy, sensitive config inventory |
| `CODE_OF_CONDUCT.md` | Contributor Covenant v2.1 |
| `CHANGELOG.md` | Release history (V3.1, V3.0, V2 archived) |
| `AGENTS.md` | This file — commands, architecture, conventions |
| `CLAUDE.md` | Claude Code guidance (points here for commands) |
| `llms.txt` | LLM-friendly project summary |
| `.github/ISSUE_TEMPLATE/` | Bug report + feature request templates |
| `.github/PULL_REQUEST_TEMPLATE.md` | PR checklist |
| `.github/workflows/ci.yml` | CI: 3 parallel jobs (backend, agent, frontend) |
| `.github/workflows/deploy.yml` | Deploy: Vercel (frontend) + Render (backend, agent) |
| `.github/workflows/eval.yml` | Weekly eval: golden set + regression detection |

