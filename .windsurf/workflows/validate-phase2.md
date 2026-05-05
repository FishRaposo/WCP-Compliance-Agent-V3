---
description: Validate Phase 2 end-to-end (WSL-native infra)
---

# Phase 2 Validation Runbook

Validates all Phase 2 exit criteria: PostgreSQL migrations, Redis cache, Elasticsearch BM25, pgvector, Phoenix observability, seed data, and all API endpoints.

## Prerequisites

- WSL Ubuntu with native PostgreSQL 16 (pgvector), Redis 7, Elasticsearch 8, Phoenix installed
- See `docs/local-dev.md` for full setup instructions

## Step 1: Start native infrastructure

```bash
sudo service postgresql start
sudo service redis-server start
sudo service elasticsearch start
# Phoenix in a separate terminal:
~/.venvs/phoenix/bin/phoenix serve
```

Verify services are running:
```bash
pg_isready -h localhost -p 5432
redis-cli ping
curl -s http://localhost:9200/_cluster/health | python3 -m json.tool
```

## Step 2: Run migrations

```bash
cd backend
export DATABASE_URL=postgresql+asyncpg://wcp:wcp@localhost:5432/wcp
poetry run alembic upgrade head
```

Expected: 5 migrations applied (001 through 005), no errors.

## Step 3: Seed data

```bash
cd backend
export DATABASE_URL=postgresql+asyncpg://wcp:wcp@localhost:5432/wcp
export REDIS_URL=redis://localhost:6379
export ELASTICSEARCH_URL=http://localhost:9200
poetry run python scripts/seed_all.py
```

Expected: DBWD rates seeded, ES index created with regulation chunks, vectors inserted.

## Step 4: Start backend with Phase 2 enabled

```bash
cd backend
export DATABASE_URL=postgresql+asyncpg://wcp:wcp@localhost:5432/wcp
export REDIS_URL=redis://localhost:6379
export ELASTICSEARCH_URL=http://localhost:9200
export CELERY_BROKER_URL=redis://localhost:6379/0
export PHASE=2
poetry run uvicorn wcp_backend.main:app --host 0.0.0.0 --port 8000 --reload
```

## Step 5: Verify health endpoint

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "ok",
  "version": "3.0.0",
  "phase": 2,
  "services": {
    "database": {"status": "ok", "message": "..."},
    "redis": {"status": "ok", "message": "..."},
    "elasticsearch": {"status": "ok", "message": "..."},
    "phoenix": {"status": "ok", "message": "..."}
  }
}
```

## Step 6: Smoke test Phase 2 endpoints

```bash
# Search (requires ES + pgvector)
curl -X POST http://localhost:8000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "electrician wage rate", "top_k": 3}'

# Decisions list (requires PostgreSQL)
curl http://localhost:8000/decisions

# Analytics volume (requires PostgreSQL)
curl "http://localhost:8000/analytics/volume?days=7"

# DBWD lookup (uses Redis cache)
curl "http://localhost:8000/dbwd/rate?trade=Electrician&locality=Washington%2C+DC"
```

## Step 7: Run tests

```bash
cd backend
export DATABASE_URL=postgresql+asyncpg://wcp:wcp@localhost:5432/wcp
export REDIS_URL=redis://localhost:6379
export ELASTICSEARCH_URL=http://localhost:9200
export CELERY_BROKER_URL=redis://localhost:6379/0
export PHASE=2
poetry run pytest tests/unit tests/integration -v
```

Expected: All tests pass, Phase-2-gated tests run (not skipped).

## Phase 2 Exit Criteria Checklist

- [ ] `alembic upgrade head` applies 001–005 migrations without error
- [ ] `seed_all.py` seeds DBWD rates, ES chunks, pgvector embeddings
- [ ] `GET /health` reports all 4 services `ok`
- [ ] `POST /search` returns regulation chunks
- [ ] `GET /decisions` returns empty list (not 503)
- [ ] `GET /analytics/volume` returns empty list (not 503)
- [ ] `GET /dbwd/rate?trade=Electrician&locality=Washington,+DC` returns cached rate
- [ ] Phoenix UI at `:6006` shows traces from pipeline runs
- [ ] All tests pass with `PHASE=2`
