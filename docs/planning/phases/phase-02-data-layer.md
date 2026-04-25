# Phase 2 — Data Layer + Infrastructure

**Goal:** Wire all external services: PostgreSQL (asyncpg), Redis (caching), Elasticsearch (BM25), pgvector (dense retrieval), Phoenix (tracing), Celery (async jobs). Run migrations. Seed data.

---

## Exit Criteria (Hard Gate)

```bash
# Infra running
docker-compose up postgres redis elasticsearch phoenix -d

# Migrations
cd backend && poetry run alembic upgrade head

# Seed
cd backend && poetry run python scripts/seed_dbwd.py
poetry run python scripts/seed_elasticsearch.py
poetry run python scripts/seed_vectors.py

# Integration tests
poetry run pytest tests/integration -v  # 0 failures

# Health check
curl http://localhost:8000/health
# → {"status":"ok","services":{"db":"ok","redis":"ok","elasticsearch":"ok","phoenix":"ok"}}
```

**Do not proceed to Phase 3 until all of the above pass.**

---

## Goals

1. Verify and fix Alembic migrations
2. Implement Redis cache-aside for DBWD lookup
3. Implement seed scripts (DBWD → PostgreSQL, chunks → ES, embeddings → pgvector)
4. Implement BM25 search (Elasticsearch)
5. Implement hybrid RAG retrieval (BM25 + vector + rerank)
6. Implement remaining API endpoints (search, decisions, analytics, jobs)
7. Implement Phoenix tracing
8. Update health endpoint for all services
9. Write integration tests

---

## Task Breakdown

### 2.1 — Verify Alembic Migrations

**Destination:** `backend/migrations/`

Verify these migrations apply cleanly:

| Migration | What it does |
|---|---|
| `001_create_audit_tables.py` | `decisions`, `audit_events` tables |
| `002_add_pgvector.py` | `CREATE EXTENSION vector`, `regulation_embeddings` table |
| `003_create_job_queue.py` | `jobs` table with Celery-compatible schema |
| `004_add_analytics_indexes.py` | Indexes on `decisions(created_at, verdict, trust_band)` |

**Fix any errors:**
```python
# 002_add_pgvector.py must handle extension already existing
def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    # ... create regulation_embeddings table
```

Run idempotency check:
```bash
poetry run alembic downgrade base
poetry run alembic upgrade head
poetry run alembic upgrade head  # second time — should be no-op
```

---

### 2.2 — Redis Cache-Aside for DBWD

**Destination:** `backend/src/wcp_backend/services/redis_cache.py` + `pipeline/dbwd_lookup.py`

**Implement `redis_cache.py`:**
```python
import redis.asyncio as redis
from wcp_backend.config import settings
from wcp_backend.models.schemas import DBWDRateRecord

_redis: redis.Redis | None = None

def get_redis() -> redis.Redis:
    global _redis
    if _redis is None:
        _redis = redis.from_url(settings.redis_url, decode_responses=True)
    return _redis

async def get_cached_rate(key: str) -> DBWDRateRecord | None:
    """Get rate from Redis cache. Returns None if miss."""
    r = get_redis()
    data = await r.get(f"dbwd:{key}")
    if data:
        return DBWDRateRecord.model_validate_json(data)
    return None

async def set_cached_rate(key: str, rate: DBWDRateRecord, ttl: int = 86400) -> None:
    """Cache rate with 24h TTL."""
    r = get_redis()
    await r.setex(f"dbwd:{key}", ttl, rate.model_dump_json())
```

**Update `dbwd_lookup.py` → `get_dbwd_rate()`:**
```python
async def get_dbwd_rate(trade: str, locality: str, effective_date: str) -> DBWDRateRecord:
    cache_key = f"{trade}:{locality}:{effective_date}"
    
    # Layer 1: Redis
    cached = await get_cached_rate(cache_key)
    if cached:
        return cached
    
    # Layer 2: PostgreSQL (Phase 2 implements this)
    db_rate = await _lookup_in_postgres(trade, locality, effective_date)
    if db_rate:
        await set_cached_rate(cache_key, db_rate)
        return db_rate
    
    # Layer 3: In-memory corpus (Phase 1 fallback)
    return _lookup_in_memory(trade)
    
    # Layer 4: SAM.gov (Phase 3+ — stub for now)
    # raise NotImplementedError("SAM.gov integration not implemented")
```

---

### 2.3 — Seed Scripts

**Destination:** `backend/scripts/`

**`seed_dbwd.py`:**
```python
#!/usr/bin/env python3
"""Load in-memory corpus into PostgreSQL for production use."""

import asyncio
import json
from pathlib import Path

from wcp_backend.services.db import async_session
from wcp_backend.models.schemas import DBWDRateRecord

CORPUS_PATH = Path(__file__).parent.parent / "src" / "wcp_backend" / "data" / "dbwd_corpus.json"

async def seed():
    with open(CORPUS_PATH) as f:
        corpus = json.load(f)
    
    async with async_session() as session:
        for item in corpus:
            record = DBWDRateRecord(**item)
            # UPSERT: insert or update
            await session.execute(
                """
                INSERT INTO dbwd_rates (trade, locality, rate, fringe, effective_date)
                VALUES (:trade, :locality, :rate, :fringe, :effective_date)
                ON CONFLICT (trade, locality, effective_date) DO UPDATE SET
                    rate = EXCLUDED.rate,
                    fringe = EXCLUDED.fringe
                """,
                record.model_dump()
            )
        await session.commit()
    
    print(f"Seeded {len(corpus)} DBWD rates")

if __name__ == "__main__":
    asyncio.run(seed())
```

**`seed_elasticsearch.py`:**
```python
#!/usr/bin/env python3
"""Index DBWD regulation chunks into Elasticsearch."""

import asyncio
from wcp_backend.services.elasticsearch import get_es_client, index_chunk

REGULATION_CHUNKS = [
    {
        "chunk_id": "dbwd_40usc_3142",
        "text": "40 U.S.C. § 3142 — Every contract in excess of $2,000...",
        "metadata": {"regulation": "40 U.S.C. § 3142", "trade": "all", "locality": "all"}
    },
    # ... more chunks
]

async def seed():
    es = get_es_client()
    
    # Create index with mapping if not exists
    try:
        await es.indices.create(
            index="dbwd_regulations",
            body={
                "mappings": {
                    "properties": {
                        "text": {"type": "text"},
                        "trade": {"type": "keyword"},
                        "locality": {"type": "keyword"},
                        "regulation": {"type": "keyword"}
                    }
                }
            }
        )
    except Exception:
        pass  # Index may exist
    
    for chunk in REGULATION_CHUNKS:
        await index_chunk(chunk["chunk_id"], chunk["text"], chunk["metadata"])
    
    print(f"Indexed {len(REGULATION_CHUNKS)} chunks")

if __name__ == "__main__":
    asyncio.run(seed())
```

**`seed_vectors.py`:**
```python
#!/usr/bin/env python3
"""Generate embeddings and store in pgvector."""

import asyncio
from sentence_transformers import SentenceTransformer
from wcp_backend.services.db import async_session

model = SentenceTransformer('all-MiniLM-L6-v2')

TEXTS = [
    "40 U.S.C. § 3142 — Prevailing wage requirement",
    # ... regulation texts
]

async def seed():
    embeddings = model.encode(TEXTS)
    
    async with async_session() as session:
        for text, embedding in zip(TEXTS, embeddings):
            await session.execute(
                """
                INSERT INTO regulation_embeddings (text, embedding)
                VALUES (:text, :embedding::vector)
                """,
                {"text": text, "embedding": embedding.tolist()}
            )
        await session.commit()
    
    print(f"Seeded {len(TEXTS)} vectors")

if __name__ == "__main__":
    asyncio.run(seed())
```

---

### 2.4 — BM25 Search (Elasticsearch)

**Destination:** `backend/src/wcp_backend/services/elasticsearch.py`

**Implement `bm25_search`:**
```python
async def bm25_search(
    query: str,
    trade: str | None = None,
    locality: str | None = None,
    top_k: int = 10
) -> list[dict]:
    es = get_es_client()
    
    must_clauses = [{"match": {"text": query}}]
    filter_clauses = []
    
    if trade:
        filter_clauses.append({"term": {"trade": trade}})
    if locality:
        filter_clauses.append({"term": {"locality": locality}})
    
    body = {
        "query": {
            "bool": {
                "must": must_clauses,
                "filter": filter_clauses
            }
        },
        "size": top_k
    }
    
    response = await es.search(index=DBWD_INDEX, body=body)
    
    return [
        {
            "chunk_id": hit["_id"],
            "text": hit["_source"]["text"],
            "score": hit["_score"],
            "metadata": {k: v for k, v in hit["_source"].items() if k != "text"}
        }
        for hit in response["hits"]["hits"]
    ]
```

---

### 2.5 — Hybrid RAG Retrieval

**Destination:** `backend/src/wcp_backend/retrieval/`

**`bm25.py`:**
```python
from wcp_backend.services.elasticsearch import bm25_search

async def bm25_retrieve(query: str, trade: str | None, locality: str | None, top_k: int = 20) -> list[dict]:
    return await bm25_search(query, trade, locality, top_k)
```

**`vector.py`:**
```python
from sentence_transformers import SentenceTransformer
from wcp_backend.services.db import async_session

_model = SentenceTransformer('all-MiniLM-L6-v2')

async def vector_retrieve(query: str, top_k: int = 20) -> list[dict]:
    embedding = _model.encode(query)
    
    async with async_session() as session:
        result = await session.execute(
            """
            SELECT text, embedding <=> :embedding::vector as distance
            FROM regulation_embeddings
            ORDER BY embedding <=> :embedding::vector
            LIMIT :top_k
            """,
            {"embedding": embedding.tolist(), "top_k": top_k}
        )
        rows = result.fetchall()
    
    return [
        {"text": row.text, "score": 1.0 - row.distance}  # convert distance to similarity
        for row in rows
    ]
```

**`cross_encoder.py`:**
```python
from sentence_transformers import CrossEncoder

_reranker = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')

def rerank(query: str, candidates: list[dict], top_k: int = 5) -> list[dict]:
    pairs = [(query, c["text"]) for c in candidates]
    scores = _reranker.predict(pairs)
    
    scored = [(score, candidate) for score, candidate in zip(scores, candidates)]
    scored.sort(reverse=True)
    
    return [c for _, c in scored[:top_k]]
```

**`hybrid.py`:**
```python
from wcp_backend.retrieval.bm25 import bm25_retrieve
from wcp_backend.retrieval.vector import vector_retrieve
from wcp_backend.retrieval.cross_encoder import rerank

async def hybrid_search(
    query: str,
    trade: str | None = None,
    locality: str | None = None,
    top_k: int = 5
) -> list[dict]:
    # Step 1: BM25 candidates
    bm25_results = await bm25_retrieve(query, trade, locality, top_k=20)
    
    # Step 2: Vector candidates
    vector_results = await vector_retrieve(query, top_k=20)
    
    # Step 3: RRF merge (Reciprocal Rank Fusion)
    merged = _rrf_merge(bm25_results, vector_results)
    
    # Step 4: Cross-encoder rerank
    return rerank(query, merged, top_k=top_k)

def _rrf_merge(bm25: list[dict], vector: list[dict], k: int = 60) -> list[dict]:
    """Reciprocal Rank Fusion: score = sum(1/(k + rank)) for each result in each list."""
    scores = {}
    
    for rank, result in enumerate(bm25):
        doc_id = result.get("chunk_id", result.get("text", ""))
        scores[doc_id] = scores.get(doc_id, 0) + 1 / (k + rank + 1)
        scores[doc_id + "_data"] = result
    
    for rank, result in enumerate(vector):
        doc_id = result.get("chunk_id", result.get("text", ""))
        scores[doc_id] = scores.get(doc_id, 0) + 1 / (k + rank + 1)
        scores[doc_id + "_data"] = result
    
    # Sort by RRF score, return data
    sorted_ids = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)
    return [scores[id + "_data"] for id in sorted_ids if not id.endswith("_data")]
```

---

### 2.6 — Remaining API Endpoints

**`search.py`:**
```python
@router.post("")
async def search_regulations(
    query: str,
    trade: str | None = None,
    locality: str | None = None,
    top_k: int = 5
) -> list[dict]:
    return await hybrid_search(query, trade, locality, top_k)
```

**`decisions.py`:**
```python
from sqlalchemy import select, desc
from wcp_backend.services.db import get_session

@router.post("")
async def create_decision(
    decision: TrustScoredDecision,
    session: AsyncSession = Depends(get_session)
) -> dict:
    # Persist to PostgreSQL
    session.add(decision)
    await session.commit()
    return {"status": "created", "job_id": decision.job_id}

@router.get("")
async def list_decisions(
    verdict: str | None = None,
    trust_band: str | None = None,
    limit: int = 20,
    offset: int = 0,
    session: AsyncSession = Depends(get_session)
) -> list[TrustScoredDecision]:
    query = select(TrustScoredDecision).order_by(desc("created_at"))
    if verdict:
        query = query.where(TrustScoredDecision.verdict == verdict)
    if trust_band:
        query = query.where(TrustScoredDecision.trust_band == trust_band)
    query = query.limit(limit).offset(offset)
    result = await session.execute(query)
    return result.scalars().all()

@router.get("/{job_id}")
async def get_decision(
    job_id: str,
    session: AsyncSession = Depends(get_session)
) -> TrustScoredDecision:
    result = await session.execute(
        select(TrustScoredDecision).where(TrustScoredDecision.job_id == job_id)
    )
    decision = result.scalar_one_or_none()
    if not decision:
        raise HTTPException(404, f"Decision not found: {job_id}")
    return decision
```

**`analytics.py`:**
```python
@router.get("/volume")
async def get_volume(days: int = 30) -> list[dict]:
    """Decision count per day for last N days."""
    pass  # TODO: implement SQL query

@router.get("/approval-rate")
async def get_approval_rate() -> dict:
    """Overall approval rate + by trade."""
    pass  # TODO: implement

@router.get("/cost")
async def get_cost(days: int = 30) -> list[dict]:
    """Total token cost per day."""
    pass  # TODO: implement
```

**`jobs.py`:**
```python
from wcp_backend.services.job_queue import enqueue_job

@router.post("")
async def create_job(request: dict) -> dict:
    """Enqueue a Celery task for async batch processing."""
    job_id = await enqueue_job("process_batch", request)
    return {"job_id": job_id, "status": "queued"}

@router.get("/{job_id}")
async def get_job_status(job_id: str) -> dict:
    """Return job status from PostgreSQL jobs table."""
    pass  # TODO: implement
```

---

### 2.7 — Phoenix Tracing

**Destination:** `backend/src/wcp_backend/observability/`

**`phoenix_setup.py`:**
```python
import os
from phoenix.otel import register

def init_phoenix():
    if os.getenv("PHOENIX_COLLECTOR_ENDPOINT"):
        register(endpoint=os.getenv("PHOENIX_COLLECTOR_ENDPOINT"))
```

**`tracing.py`:**
```python
from functools import wraps
from opentelemetry import trace

tracer = trace.get_tracer("wcp_backend")

def trace_span(name: str):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            with tracer.start_as_current_span(name) as span:
                span.set_attribute("function", func.__name__)
                return await func(*args, **kwargs)
        return wrapper
    return decorator
```

Apply decorators to key functions in `extraction.py`, `rules.py`, `hybrid.py`.

---

### 2.8 — Health Endpoint Update

**Update `backend/src/wcp_backend/api/health.py`:**
```python
import asyncio
from wcp_backend.services.db import engine
from wcp_backend.services.redis_cache import get_redis
from wcp_backend.services.elasticsearch import get_es_client

@router.get("")
async def health() -> dict:
    services = {"db": "unknown", "redis": "unknown", "elasticsearch": "unknown", "phoenix": "unknown"}
    
    # Check DB
    try:
        async with engine.connect() as conn:
            await conn.execute("SELECT 1")
        services["db"] = "ok"
    except Exception as e:
        services["db"] = f"error: {str(e)}"
    
    # Check Redis
    try:
        r = get_redis()
        await r.ping()
        services["redis"] = "ok"
    except Exception as e:
        services["redis"] = f"error: {str(e)}"
    
    # Check ES
    try:
        es = get_es_client()
        await es.ping()
        services["elasticsearch"] = "ok"
    except Exception as e:
        services["elasticsearch"] = f"error: {str(e)}"
    
    # Phoenix is assumed ok if configured (no ping endpoint)
    if os.getenv("PHOENIX_COLLECTOR_ENDPOINT"):
        services["phoenix"] = "configured"
    else:
        services["phoenix"] = "not configured"
    
    overall = "ok" if all(s == "ok" or s == "configured" for s in services.values()) else "degraded"
    
    return {"status": overall, "services": services, "version": "3.0.2"}
```

---

### 2.9 — Integration Tests

**Destination:** `backend/tests/integration/`

**`test_api_extract.py`:**
- Test multipart PDF upload
- Test JSON text extraction
- Test validation errors

**`test_api_validate.py`:**
- Post complete ExtractedWCP → receive DeterministicReport
- Verify all check IDs present

**`test_api_dbwd.py`:**
- `GET /dbwd/Electrician/Washington, DC/2026-01-01` returns rate
- Second call returns cached result (faster)
- Unknown trade returns 404

**`test_api_search.py`:**
- Post search query → receive top-5 chunks
- Verify results have text and score

**`test_api_decisions.py`:**
- Post decision → 201 created
- Get decision by job_id → matches posted data
- List decisions with filters works

**Minimum: 25 integration tests**

---

## Architecture Notes

### Single Database for Relational + Vector
PostgreSQL + pgvector is an intentional ADR-007 decision. Avoids separate Pinecone/Weaviate deployment. Trade-off: vector ops are slower than dedicated vector DB, but acceptable for <10k regulation chunks.

### Elasticsearch Yellow Status Is Normal
Single-node, no replicas. Do not set `number_of_replicas > 0` in dev. ES cluster health will show "yellow" — this is expected.

### Cache TTL = 24h for DBWD Rates
DBWD rates rarely change. The `refresh_rates_from_sam_gov()` task (Phase 3+) handles invalidation.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| pgvector extension not installed | Low | High | Migration uses `CREATE EXTENSION IF NOT EXISTS`. Verify Docker image. |
| ES index mapping conflicts on re-seed | Medium | Low | Use `ignore=400` on create. Add `--reset` flag to drop+recreate. |
| Cross-encoder reranking > 200ms | Medium | Medium | Benchmark with pytest-benchmark. Reduce candidates from 40→20 if needed. |
| Celery can't connect to Redis in CI | Low | Medium | Use `CELERY_ALWAYS_EAGER=True` in test config for inline execution. |

---

## Command Reference

```bash
# Start infra
docker-compose up postgres redis elasticsearch phoenix -d

# Run migrations
cd backend && poetry run alembic upgrade head

# Seed data
cd backend && poetry run python scripts/seed_dbwd.py
poetry run python scripts/seed_elasticsearch.py
poetry run python scripts/seed_vectors.py

# Run integration tests
poetry run pytest tests/integration -v

# Full health check
curl http://localhost:8000/health

# Manual API test
curl -X POST http://localhost:8000/search -H "Content-Type: application/json" \
  -d '{"query": "prevailing wage electrician", "top_k": 5}'
```

---

*Phase 2 document version: 2026-04-22*
*Blocked by: Phase 1 unit tests passing*
