"""Health check service for monitoring infrastructure connectivity."""

from typing import Any

from sqlalchemy import text

from wcp_backend.config import settings
from wcp_backend.services.db import engine
from wcp_backend.services.elasticsearch import health_check as elasticsearch_health_check
from wcp_backend.services.redis_cache import health_check as redis_health_check


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
    if await redis_health_check():
        return {"status": "ok", "message": "Connected"}
    return {"status": "error", "message": "Redis connection failed"}


async def check_elasticsearch() -> dict[str, Any]:
    """Check Elasticsearch connectivity."""
    health = await elasticsearch_health_check()
    if health["status"] in ("ok", "warning"):
        return {
            "status": health["status"],
            "message": f"Cluster status: {health.get('cluster_status', 'unknown')}",
        }
    return {"status": "error", "message": "Elasticsearch connection failed"}


async def check_phoenix() -> dict[str, Any]:
    """Report Phoenix configuration status."""
    if settings.phoenix_collector_endpoint:
        return {"status": "ok", "message": "Configured"}
    return {"status": "warning", "message": "Phoenix collector endpoint not configured"}


async def get_health_status() -> dict[str, Any]:
    """Get comprehensive health status of all services."""
    if settings.phase < 2:
        return {"status": "ok", "version": "3.0.0", "phase": settings.phase}

    db_status = await check_database()
    redis_status = await check_redis()
    es_status = await check_elasticsearch()
    phoenix_status = await check_phoenix()

    all_ok = all(
        s["status"] == "ok" for s in [db_status, redis_status, es_status, phoenix_status]
    )

    return {
        "status": "ok" if all_ok else "degraded",
        "version": "3.0.0",
        "phase": settings.phase,
        "services": {
            "database": db_status,
            "redis": redis_status,
            "elasticsearch": es_status,
            "phoenix": phoenix_status,
        },
    }
