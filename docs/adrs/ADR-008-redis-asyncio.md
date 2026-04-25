# ADR-008: redis.asyncio over aioredis

**Status:** Accepted

**Date:** 2026-04-22

**Author:** Vinícius Raposo

---

## Context

V3 needs Redis for:
- Celery broker (async task queue)
- DBWD rate caching (cache expensive lookups)
- Session/state storage (optional)

The original plan listed `aioredis`.

---

## Decision

Use **`redis.asyncio`** (from `redis-py` package) instead of standalone `aioredis`.

---

## Rationale

**Deprecation:**
- `aioredis` was merged into `redis-py` in 2023
- `aioredis` is no longer maintained as a separate package
- Using `aioredis` in 2026 signals outdated knowledge

**Migration:**
```python
# OLD (deprecated)
import aioredis
redis = aioredis.from_url("redis://localhost")

# NEW (correct)
from redis.asyncio import Redis
redis = Redis.from_url("redis://localhost")
```

Same functionality, correct import path.

---

## Why This Matters

Code reviewers scanning requirements.txt or imports will notice:
- `aioredis` → Deprecated, not maintained
- `redis.asyncio` → Current Python async best practice

Small detail, strong engineering signal.

---

## Usage

```python
# backend/src/services/redis_cache.py
from redis.asyncio import Redis
from functools import wraps

redis = Redis.from_url(REDIS_URL, decode_responses=True)

async def get_cached_dbwd(trade: str, locality: str):
    key = f"dbwd:{trade}:{locality}"
    cached = await redis.get(key)
    if cached:
        return json.loads(cached)
    
    # Fetch from DB or SAM.gov API
    result = await fetch_dbwd(trade, locality)
    await redis.setex(key, 3600, json.dumps(result))  # 1 hour TTL
    return result
```

---

## Connection Pooling

```python
# Initialize once, reuse
redis = Redis.from_url(
    REDIS_URL,
    max_connections=50,
    decode_responses=True
)

# FastAPI lifespan
@app.on_event("startup")
async def startup():
    await redis.ping()
```

---

## Consequences

**Positive:**
- Current best practice
- One less dependency (redis-py includes asyncio support)
- Maintained by Redis Labs

**Negative:**
- None. This is purely a naming change.

---

## Related

- ADR-006: Celery (uses Redis as broker, same package)
