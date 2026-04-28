# Fresh Machine Install

This is the shortest path for setting up the repo on another machine without Docker.

## Supported Path

Use WSL Ubuntu 24.04 or another Ubuntu-like Linux environment. The installer uses `apt`, `service`, Poetry, npm, PostgreSQL 16, pgvector, Redis, Elasticsearch 8.x, and Phoenix.

## One Command Install

From a fresh clone:

```bash
git clone https://github.com/FishRaposo/WCP-Compliance-Agent-V3.git
cd WCP-Compliance-Agent-V3
bash scripts/setup-wsl-native.sh
```

The script asks for sudo because it installs system packages and configures local services.
It also creates the `vector` extension in `wcp`, `wcp_test`, and `wcp_eval` as the local PostgreSQL admin user so Alembic can run under the normal `wcp` role.

## Readiness Check

After installation, run:

```bash
bash scripts/check-install.sh
```

Failures mean required tools or lockfiles are missing. Warnings usually mean a local service is stopped.

## Environment Files

Each service has an example env file:

```bash
cp backend/.env.example backend/.env
cp agent/.env.example agent/.env
cp frontend/.env.example frontend/.env
```

The local defaults are:

```bash
DATABASE_URL=postgresql+asyncpg://wcp:wcp@localhost:5432/wcp
REDIS_URL=redis://localhost:6379
ELASTICSEARCH_URL=http://localhost:9200
PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006
BACKEND_URL=http://localhost:8000
VITE_API_URL=http://localhost:3000
```

For deterministic local development, keep the agent in mock mode:

```bash
OPENAI_API_KEY=mock
LLM_MODE=mock
AUTH_DISABLED=true
```

## Verify

Backend:

```bash
cd backend
export DATABASE_URL=postgresql+asyncpg://wcp:wcp@localhost:5432/wcp_test
export REDIS_URL=redis://localhost:6379
export ELASTICSEARCH_URL=http://localhost:9200
export PHASE=2
poetry run alembic upgrade head
poetry run python scripts/seed_all.py
poetry run pytest tests/unit tests/integration -v
```

Agent:

```bash
cd agent
npm run typecheck
npm test
npm run build
```

Frontend:

```bash
cd frontend
npm run typecheck
npm run build
```

## Dependency Sources

- Python backend: `backend/pyproject.toml`, `backend/poetry.lock`, and root `requirements.txt`
- Agent: `agent/package.json` and `agent/package-lock.json`
- Frontend: `frontend/package.json` and `frontend/package-lock.json`
- System dependencies: `scripts/setup-wsl-native.sh` and `docs/dependencies.md`

Do not run root-level build or test commands; this project is three independent services.
