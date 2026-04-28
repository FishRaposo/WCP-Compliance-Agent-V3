"""redis.asyncio wrapper for DBWD rate caching and general key-value ops."""

from __future__ import annotations

import json
from typing import Any, cast

import redis.asyncio as aioredis

from wcp_backend.config import settings

_pool: aioredis.Redis | None = None

DBWD_CACHE_TTL = 3600 * 24  # 24 hours


def get_redis() -> aioredis.Redis:
    global _pool
    if _pool is None:
        _pool = aioredis.from_url(  # type: ignore[no-untyped-call]
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
    return _pool


async def cache_get(key: str) -> Any | None:
    client = get_redis()
    value = await client.get(key)
    return json.loads(value) if value else None


async def cache_set(key: str, value: Any, ttl: int = DBWD_CACHE_TTL) -> None:
    client = get_redis()
    await client.setex(key, ttl, json.dumps(value))


def dbwd_cache_key(trade: str, locality: str, date: str) -> str:
    return f"dbwd:{trade.lower()}:{locality.lower()}:{date}"


async def health_check() -> bool:
    """Check Redis connectivity with PING.
    
    Returns:
        True if Redis is reachable and responding, False otherwise
    """
    client: aioredis.Redis | None = None
    try:
        client = aioredis.from_url(  # type: ignore[no-untyped-call]
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        result = await cast(Any, client.ping())
        return result is True or result == "PONG"
    except Exception:
        return False
    finally:
        if client is not None:
            await client.aclose()
