# Local Development Guide

This project uses WSL-native Ubuntu with every service bound to `localhost`.

The repo is still three independent services. Always `cd` into the service directory before running package, test, build, or dev-server commands.

For a fresh-machine install checklist, see `docs/install.md`. For the full dependency inventory, see `docs/dependencies.md`.

The fastest install path is:

```bash
bash scripts/setup-wsl-native.sh
bash scripts/check-install.sh
```

## Prerequisites

| Tool | Version | Install |
|---|---:|---|
| WSL Ubuntu | 24.04 preferred | Microsoft Store or `wsl --install` |
| Python | 3.12 | Ubuntu packages |
| Poetry | 1.8+ | `pipx install poetry` |
| Node.js | 20+ | NodeSource or `nvm` |
| PostgreSQL | 16 + pgvector | Ubuntu packages |
| Redis | 7 | Ubuntu packages |
| Elasticsearch | 8.x | Elastic APT repo |
| Phoenix | current CLI | `pipx install arize-phoenix` or a Python venv |

All development uses WSL-native services. No Docker required.

## Native Infrastructure

Install base packages:

```bash
sudo apt update
sudo apt install -y \
  build-essential curl gpg ca-certificates apt-transport-https pipx \
  python3.12 python3.12-venv python3-pip \
  postgresql-16 postgresql-16-pgvector redis-server
pipx ensurepath
pipx install poetry
```

Install Node.js 20 with your preferred WSL method. With NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Install Elasticsearch 8.x from Elastic's APT repo:

```bash
wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch \
  | sudo gpg --dearmor -o /usr/share/keyrings/elasticsearch-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/elasticsearch-keyring.gpg] https://artifacts.elastic.co/packages/8.x/apt stable main" \
  | sudo tee /etc/apt/sources.list.d/elastic-8.x.list
sudo apt update
sudo apt install -y elasticsearch
```

Configure Elasticsearch for local single-node development:

```bash
sudo tee -a /etc/elasticsearch/elasticsearch.yml >/dev/null <<'EOF'
discovery.type: single-node
xpack.security.enabled: false
xpack.security.http.ssl.enabled: false
network.host: 127.0.0.1
http.port: 9200
EOF
```

Start native services:

```bash
sudo service postgresql start
sudo service redis-server start
sudo service elasticsearch start
```

Create the local PostgreSQL role and databases:

```bash
sudo -u postgres psql <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'wcp') THEN
    CREATE ROLE wcp WITH LOGIN PASSWORD 'wcp';
  END IF;
END
$$;
ALTER ROLE wcp CREATEDB;
SQL

sudo -u postgres createdb -O wcp wcp || true
sudo -u postgres createdb -O wcp wcp_test || true
sudo -u postgres createdb -O wcp wcp_eval || true
```

Run Phoenix in a separate terminal:

```bash
python3.12 -m venv ~/.venvs/phoenix
~/.venvs/phoenix/bin/pip install arize-phoenix
~/.venvs/phoenix/bin/phoenix serve
```

Service URLs:

| Service | URL |
|---|---|
| PostgreSQL | `postgresql+asyncpg://wcp:wcp@localhost:5432/wcp` |
| Redis | `redis://localhost:6379` |
| Elasticsearch | `http://localhost:9200` |
| Phoenix | `http://localhost:6006` |

## Backend

```bash
cd backend
poetry install
```

Use these environment values for normal local development:

```bash
export DATABASE_URL=postgresql+asyncpg://wcp:wcp@localhost:5432/wcp
export REDIS_URL=redis://localhost:6379
export ELASTICSEARCH_URL=http://localhost:9200
export CELERY_BROKER_URL=redis://localhost:6379/0
export CELERY_RESULT_BACKEND=redis://localhost:6379/1
export PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006
export PHASE=2
```

Run migrations and seed data:

```bash
poetry run alembic upgrade head
poetry run python scripts/seed_all.py
```

Start the backend:

```bash
poetry run uvicorn wcp_backend.main:app --host 0.0.0.0 --port 8000 --reload
```

Verify:

```bash
curl http://localhost:8000/health
```

## Agent

```bash
cd agent
npm ci
```

Use these environment values for deterministic local development:

```bash
export BACKEND_URL=http://localhost:8000
export OPENAI_API_KEY=mock
export LLM_MODE=mock
export AUTH_DISABLED=true
export JWT_SECRET=dev-secret-change-before-launch-min-32-chars
export PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006
```

Start the agent:

```bash
npm run dev
```

Verify:

```bash
curl http://localhost:3000/health
```

## Frontend

```bash
cd frontend
npm ci
```

Use this environment value:

```bash
export VITE_API_URL=http://localhost:3000
```

Start Vite:

```bash
npm run dev
```

Open `http://localhost:5173`.

## Full Deterministic Verification

Run backend verification against `wcp_test`:

```bash
cd backend
export DATABASE_URL=postgresql+asyncpg://wcp:wcp@localhost:5432/wcp_test
export REDIS_URL=redis://localhost:6379
export ELASTICSEARCH_URL=http://localhost:9200
export CELERY_BROKER_URL=redis://localhost:6379/0
export CELERY_RESULT_BACKEND=redis://localhost:6379/1
export PHASE=2

poetry run alembic upgrade head
poetry run python scripts/seed_all.py
poetry run pytest tests/unit tests/integration -v
```

Run the current golden-set eval against `wcp_eval`:

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

The current eval runner is deterministic and does not require a real `OPENAI_API_KEY`. Real LLM baseline verification is a later launch gate.

Run agent checks:

```bash
cd agent
npm ci
npm run typecheck
npm test
npm run build
```

Run frontend checks:

```bash
cd frontend
npm ci
npm run typecheck
npm run build
```

## Common Issues

**`poetry install` is slow or fails on native packages**
Install `build-essential`, `python3.12-dev` if needed, and prefer running inside a Linux-native WSL path for long installs. The OneDrive-mounted `/mnt/c` path can be much slower for dependency builds.

**PostgreSQL connection refused**
Start PostgreSQL with `sudo service postgresql start` and verify with `pg_isready -h localhost -p 5432`.

**`CREATE EXTENSION vector` fails**
Install `postgresql-16-pgvector`, then rerun `poetry run alembic upgrade head`.

**Elasticsearch health is yellow**
Yellow is normal for a single-node local cluster because replicas are not allocated. The system can still run.

**Agent cannot reach backend**
Set `BACKEND_URL=http://localhost:8000` in the agent environment.

**Frontend API calls fail**
Set `VITE_API_URL=http://localhost:3000` before starting Vite.

## Dependency Update Policy

| Service | Lock file | Update command |
|---|---|---|
| Backend | `poetry.lock` | `poetry update` |
| Agent | `package-lock.json` | `npm update` |
| Frontend | `package-lock.json` | `npm update` |

Pin major versions of `@mastra/core`, `fastapi`, and `@ai-sdk/openai`; these have breaking changes between minors.
