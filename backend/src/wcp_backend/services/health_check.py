"""Health check service for monitoring infrastructure connectivity."""

from typing import Any

from sqlalchemy import text

from wcp_backend.config import settings
from wcp_backend.services.db import engine
from wcp_backend.services.elasticsearch import get_es_client
from wcp_backend.services.redis_cache import get_redis


async def check_database() -> dict[str, Any]:
    """Check PostgreSQL connectivity."""
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            result.scalar()
        return {"status": "ok", "message": "Connected"}
    except Exception:
        return {"status": "error", "message": "Database connection failed"}


async def check_redis() -> dict[str, Any]:
    """Check Redis connectivity."""
    try:
        r = get_redis()
        await r.ping()
        return {"status": "ok", "message": "Connected"}
    except Exception:
        return {"status": "error", "message": "Redis connection failed"}


async def check_elasticsearch() -> dict[str, Any]:
    """Check Elasticsearch connectivity."""
    try:
        es = get_es_client()
        health = await es.cluster.health()
        status = health.get("status", "unknown")
        return {
            "status": "ok" if status in ("green", "yellow") else "warning",
            "message": f"Cluster status: {status}",
        }
    except Exception:
        return {"status": "error", "message": "Elasticsearch connection failed"}


async def get_health_status() -> dict[str, Any]:
    """Get comprehensive health status of all services."""
    db_status = await check_database()
    redis_status = await check_redis()
    es_status = await check_elasticsearch()

    all_ok = all(
        s["status"] == "ok" for s in [db_status, redis_status, es_status]
    )

    return {
        "status": "ok" if all_ok else "degraded",
        "version": "3.0.0",
        "phase": settings.phase,
        "services": {
            "database": db_status,
            "redis": redis_status,
            "elasticsearch": es_status,
        },
    }
