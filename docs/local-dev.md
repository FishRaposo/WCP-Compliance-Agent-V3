# Local Development Guide

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Python | 3.12+ | [python.org](https://python.org) or `pyenv install 3.12` |
| Poetry | 1.8+ | `pip install poetry` |
| Node.js | 20+ | [nodejs.org](https://nodejs.org) or `nvm install 20` |
| Docker + Docker Compose | Latest | [docker.com](https://docker.com) |
| Git | Any | pre-installed on most systems |

---

## Quickest Start: Docker Compose (Full Stack)

```bash
cp .env.example .env
# Edit .env — set OPENAI_API_KEY (or leave as "mock" for offline dev)

docker-compose up --build

# Services:
#   Frontend   http://localhost:5173
#   Agent API  http://localhost:3000
#   Backend    http://localhost:8000/docs  (FastAPI Swagger)
#   Phoenix    http://localhost:6006
#   Flower     http://localhost:5555
```

---

## Running Each Service Independently

Run services individually during active development — faster iteration than rebuilding Docker images.

### 1. Data Layer (always required)

```bash
# Start PostgreSQL + Redis + Elasticsearch + Phoenix
docker-compose up postgres redis elasticsearch phoenix -d

# Verify
docker-compose ps
```

### 2. Backend (Python / FastAPI)

```bash
cd backend

# Install dependencies
poetry install

# Copy env
cp ../.env.example .env
# Edit: DATABASE_URL, REDIS_URL, ELASTICSEARCH_URL must point to localhost services above

# Run migrations
poetry run alembic upgrade head

# Start dev server (hot-reload)
poetry run uvicorn wcp_backend.main:app --host 0.0.0.0 --port 8000 --reload

# Verify
curl http://localhost:8000/health
# → {"status":"ok","version":"3.0.0"}

# Swagger UI (full API docs)
open http://localhost:8000/docs
```

**Run backend tests:**
```bash
cd backend
poetry run pytest tests/unit -v                    # Unit tests only (no services needed)
poetry run pytest tests/integration -v             # Requires postgres + redis
poetry run pytest tests/eval/ --benchmark-only     # Golden set (requires full stack)
```

### 3. Agent (TypeScript / Hono / Mastra)

```bash
cd agent

npm install

# Copy env — must point BACKEND_URL to running backend
cp ../.env.example .env
# Edit: BACKEND_URL=http://localhost:8000, OPENAI_API_KEY=your-key-or-mock

# Start dev server (hot-reload via tsx watch)
npm run dev

# Verify
curl http://localhost:3000/health
# → {"status":"ok","version":"3.0.0"}
```

**Run agent tests:**
```bash
cd agent
npm test
```

### 4. Frontend (React 19 / Vite)

```bash
cd frontend

npm install

# Copy env — VITE_API_URL must point to running agent
cp ../.env.example .env
# Edit: VITE_API_URL=http://localhost:3000

# Start Vite dev server
npm run dev

# Open
open http://localhost:5173
```

**Frontend type check:**
```bash
cd frontend
npm run typecheck
npm run build   # full production build check
```

---

## Mock Mode (No OpenAI Key Required)

Set `OPENAI_API_KEY=mock` in any `.env` file. The agent will return deterministic verdicts without calling OpenAI — useful for local UI development and CI without API costs.

Reference: `_archive/src/utils/mock-responses.ts` shows the mock response shape (the V3 equivalent lives in `agent/src/prompts/versions/`).

```bash
# Example .env for full offline dev
OPENAI_API_KEY=mock
DATABASE_URL=postgresql+asyncpg://wcp:wcp@localhost:5432/wcp
REDIS_URL=redis://localhost:6379
ELASTICSEARCH_URL=http://localhost:9200
BACKEND_URL=http://localhost:8000
```

---

## Seeding Data

Before running the full pipeline, seed the data layer:

```bash
cd backend

# 1. Seed DBWD rates (Davis-Bacon prevailing wage table)
poetry run python scripts/seed_dbwd.py

# 2. Index regulation chunks into Elasticsearch (BM25 retrieval)
poetry run python scripts/seed_elasticsearch.py

# 3. Generate embeddings and upsert into pgvector
poetry run python scripts/seed_vectors.py
```

The fallback corpus (20 trades, in-memory) from `_archive/data/dbwd-corpus.json` is bundled into the backend config — no seeding required to get basic decisions working.

---

## Common Issues

**`poetry install` fails on `sentence-transformers`**
Requires a C compiler. On Ubuntu: `apt install build-essential`. On Mac: `xcode-select --install`.

**`asyncpg` connection refused**
Backend is trying to connect before PostgreSQL is ready. Wait ~10s after `docker-compose up postgres` before starting the backend.

**Elasticsearch `health` returns yellow**
Normal for single-node ES. The system works fine; yellow just means no replica shards.

**Agent can't reach backend**
Make sure `BACKEND_URL` in `agent/.env` points to `http://localhost:8000` (not the Docker hostname `backend:8000`) when running the agent outside Docker.

---

## Dependency Update Policy

| Service | Lock file | Update command |
|---|---|---|
| Backend | `poetry.lock` | `poetry update` |
| Agent | `package-lock.json` | `npm update` |
| Frontend | `package-lock.json` | `npm update` |

Pin major versions of `@mastra/core`, `fastapi`, and `@ai-sdk/openai` — these have breaking changes between minors.
