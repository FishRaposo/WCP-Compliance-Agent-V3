---
description: Validate Phase 2 end-to-end (Docker local + CI)
---

# Phase 2 Validation Runbook

Validates all Phase 2 exit criteria: PostgreSQL migrations, Redis cache, Elasticsearch BM25, pgvector, Phoenix observability, seed data, and all API endpoints.

## Prerequisites

- Docker Desktop running on Windows
- `.env` file in project root (copy from `.env.example` if present, or set vars below)

## Step 1: Start infrastructure only

```powershell
docker-compose up postgres redis elasticsearch phoenix -d
```

Wait for all services to be healthy (~30s for ES):

```powershell
docker-compose ps
```

All four services should show `(healthy)`.

## Step 2: Run migrations

```powershell
$env:DATABASE_URL="postgresql+asyncpg://wcp:wcp@localhost:5432/wcp"
cd backend
poetry run alembic upgrade head
```

Expected: 5 migrations applied (001 through 005), no errors.

## Step 3: Seed data

```powershell
$env:DATABASE_URL="postgresql+asyncpg://wcp:wcp@localhost:5432/wcp"
$env:REDIS_URL="redis://localhost:6379"
$env:ELASTICSEARCH_URL="http://localhost:9200"
cd backend
poetry run python scripts/seed_all.py
```

Expected: DBWD rates seeded, ES index created with regulation chunks, vectors inserted.

## Step 4: Start backend with Phase 2 enabled

```powershell
$env:DATABASE_URL="postgresql+asyncpg://wcp:wcp@localhost:5432/wcp"
$env:REDIS_URL="redis://localhost:6379"
$env:ELASTICSEARCH_URL="http://localhost:9200"
$env:CELERY_BROKER_URL="redis://localhost:6379/0"
$env:PHASE="2"
cd backend
poetry run uvicorn wcp_backend.main:app --reload
```

## Step 5: Verify health endpoint

```powershell
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "ok",
  "version": "3.0.0",
  "phase": 2,
  "services": {
    "postgresql": {"status": "ok", "message": "..."},
    "redis": {"status": "ok", "message": "..."},
    "elasticsearch": {"status": "ok", "message": "..."},
    "phoenix": {"status": "ok", "message": "..."}
  }
}
```

## Step 6: Smoke test Phase 2 endpoints

```powershell
# Search (requires ES + pgvector)
curl -X POST http://localhost:8000/search `
  -H "Content-Type: application/json" `
  -d '{"query": "electrician wage rate", "top_k": 3}'

# Decisions list (requires PostgreSQL)
curl http://localhost:8000/decisions

# Analytics volume (requires PostgreSQL)
curl "http://localhost:8000/analytics/volume?days=7"

# DBWD lookup (uses Redis cache)
curl "http://localhost:8000/dbwd/rate?trade=Electrician&locality=Washington%2C+DC"
```

## Step 7: Run integration tests with Phase 2

```powershell
$env:DATABASE_URL="postgresql+asyncpg://wcp:wcp@localhost:5432/wcp"
$env:REDIS_URL="redis://localhost:6379"
$env:ELASTICSEARCH_URL="http://localhost:9200"
$env:CELERY_BROKER_URL="redis://localhost:6379/0"
$env:PHASE="2"
cd backend
poetry run pytest tests/unit tests/integration -v
```

Expected: All tests pass, Phase-2-gated tests run (not skipped).

## Step 8: Full Docker stack

```powershell
docker-compose up --build
```

All services start. Verify:
- Backend: `curl http://localhost:8000/health`
- Agent: `curl http://localhost:3000/health`
- Frontend: open `http://localhost:5173` in browser
- Phoenix: open `http://localhost:6006` in browser
- Flower: open `http://localhost:5555` in browser

## CI Verification

Push to `main` or `develop`. GitHub Actions CI (`ci.yml`) will:
1. Spin up postgres (pgvector:pg16), redis, elasticsearch
2. Run `alembic upgrade head`
3. Run `seed_all.py`
4. Run `pytest tests/unit tests/integration -v` with `PHASE=2`

All three jobs (backend, agent, frontend) must pass green.

## Phase 2 Exit Criteria Checklist

- [ ] `alembic upgrade head` applies 001–005 migrations without error
- [ ] `seed_all.py` seeds DBWD rates, ES chunks, pgvector embeddings
- [ ] `GET /health` reports all 4 services `ok`
- [ ] `POST /search` returns regulation chunks
- [ ] `GET /decisions` returns empty list (not 503)
- [ ] `GET /analytics/volume` returns empty list (not 503)
- [ ] `GET /dbwd/rate?trade=Electrician&locality=Washington,+DC` returns cached rate
- [ ] Phoenix UI at `:6006` shows traces from pipeline runs
- [ ] All 120+ tests pass in CI with `PHASE=2`
