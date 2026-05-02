# Dependencies

This repo has three independent services plus local infrastructure. There is no root package manager or monorepo command. Always install and run dependencies from the service directory.

## Fast Path: WSL Native

The easiest setup is the WSL installer:

```bash
bash scripts/setup-wsl-native.sh
bash scripts/check-install.sh
```

The script installs Ubuntu packages, Poetry, Node.js, PostgreSQL + pgvector, Redis, Elasticsearch 8.x, Phoenix, and each service's lockfile dependencies. It also creates the local `wcp`, `wcp_test`, and `wcp_eval` databases.
The script creates the `vector` extension in each local database as the PostgreSQL admin user before backend migrations run.

It will ask for your sudo password because PostgreSQL, Redis, Elasticsearch, and system packages are installed through `apt`.

For a fresh-machine walkthrough, see `docs/install.md`.

## System Dependencies

| Dependency | Version | Why it is needed | Install source |
|---|---:|---|---|
| WSL Ubuntu | 24.04 preferred | Supported development environment | Microsoft Store or `wsl --install` |
| Python | 3.12 | Backend runtime and tooling | Ubuntu `python3.12` packages |
| `python3.12-venv` | matching Python | Poetry environments and Phoenix venv | Ubuntu apt |
| `python3-pip` | distro version | pipx/Phoenix bootstrap fallback | Ubuntu apt |
| `build-essential` | distro version | Native Python dependency builds | Ubuntu apt |
| `python3.12-dev` | matching Python | Python headers for native extensions | Ubuntu apt |
| Poetry | 1.8+ | Backend dependency manager | `pipx install poetry` |
| Node.js | 20+ | Agent and frontend runtime | NodeSource or `nvm` |
| npm | lockfile-compatible | Agent and frontend package manager | bundled with Node |
| PostgreSQL | 16 | Backend database and audit storage | Ubuntu apt |
| pgvector | PostgreSQL 16 package | Vector table/index support | `postgresql-16-pgvector` |
| Redis | 7 | Cache and Celery broker/result backend | Ubuntu apt |
| Elasticsearch | 8.x | BM25 regulation search | Elastic 8.x APT repo |
| Phoenix | current CLI | Local trace UI | Python venv or pipx |

## Service Dependencies

Backend dependencies are declared in `backend/pyproject.toml` and locked in `backend/poetry.lock`:

```bash
cd backend
poetry install                    # Core V3 deps only
poetry install -E v4              # V3 + all V4 extras (DuckDB, Parquet, Prefect, GE, paramiko)
poetry install -E olap            # V3 + DuckDB + PyArrow only
poetry install -E sftp            # V3 + paramiko SFTP connector only
poetry install -E ge              # V3 + Great Expectations + pandas only
```

For pip-based setup or quick environment repair, use the root `requirements.txt`:

```bash
python3.12 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

Agent dependencies are declared in `agent/package.json` and locked in `agent/package-lock.json`:

```bash
cd agent
npm ci
```

Frontend dependencies are declared in `frontend/package.json` and locked in `frontend/package-lock.json`:

```bash
cd frontend
npm ci
```

Use `npm ci`, not `npm install`, for normal setup because this repo expects lockfile fidelity.

## Local Service URLs

Use these defaults for local development:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://wcp:wcp@localhost:5432/wcp` |
| `REDIS_URL` | `redis://localhost:6379` |
| `ELASTICSEARCH_URL` | `http://localhost:9200` |
| `CELERY_BROKER_URL` | `redis://localhost:6379/0` |
| `CELERY_RESULT_BACKEND` | `redis://localhost:6379/1` |
| `PHOENIX_COLLECTOR_ENDPOINT` | `http://localhost:6006` |
| `BACKEND_URL` | `http://localhost:8000` |
| `VITE_API_URL` | `http://localhost:3000` |

## V4 Optional Dependencies

V4 data-platform features (DuckDB OLAP, Parquet archival, Prefect ETL, Great Expectations validation, SFTP connectors) are optional extras in `pyproject.toml`. Install only what you need:

| Extra | Packages | Use case |
|---|---|---|
| `v4` | duckdb, pyarrow, pandas, prefect, great-expectations, paramiko | All V4 features |
| `olap` | duckdb, pyarrow | DuckDB analytics + Parquet export |
| `ge` | great-expectations, pandas | Data quality validation |
| `sftp` | paramiko | SFTP payroll file ingestion |

V4 Python modules use lazy imports and graceful fallback — they work even without their optional packages installed (DuckDB queries fall back to PostgreSQL, GE validation falls back to custom validators, SFTP connector raises a clear error).

## Verification Commands

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

Eval:

```bash
cd backend
export DATABASE_URL=postgresql+asyncpg://wcp:wcp@localhost:5432/wcp_eval
export REDIS_URL=redis://localhost:6379
export ELASTICSEARCH_URL=http://localhost:9200
export PHASE=2
poetry run alembic upgrade head
poetry run python scripts/seed_all.py
poetry run pytest tests/eval/ --benchmark-only -v
poetry run python tests/eval/regression_test.py
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

## Troubleshooting

If `python3.12 -m venv` fails, install `python3.12-venv`.

If `CREATE EXTENSION vector` fails, install `postgresql-16-pgvector` and rerun migrations.

If `poetry install` is very slow on `/mnt/c/...`, copy the repo to a Linux-native WSL path such as `~/src/WCP-Compliance-Agent` for dependency installation and test runs.

If `npm ci` fails with missing Rollup optional native packages, remove the generated service `node_modules` directory and rerun `npm ci` inside that service.

If agent tests fail with `listen EPERM` on port `9999`, rerun the tests from a terminal with permission to bind local ports.
