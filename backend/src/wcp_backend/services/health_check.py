"""Health check service for monitoring infrastructure connectivity."""

from typing import Any

from wcp_backend.config import settings


async def check_database() -> dict[str, Any]:
    """Check PostgreSQL connectivity."""
    try:
        from sqlalchemy.ext.asyncio import create_async_engine
        from sqlalchemy import text
        
        engine = create_async_engine(settings.database_url, pool_pre_ping=True)
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            await result.scalar()
        await engine.dispose()
        
        return {"status": "ok", "message": "Connected"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


async def check_redis() -> dict[str, Any]:
    """Check Redis connectivity."""
    try:
        import redis.asyncio as redis
        
        r = redis.from_url(settings.redis_url)
        await r.ping()
        await r.close()
        
        return {"status": "ok", "message": "Connected"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


async def check_elasticsearch() -> dict[str, Any]:
    """Check Elasticsearch connectivity."""
    try:
        from elasticsearch import AsyncElasticsearch
        
        es = AsyncElasticsearch([settings.elasticsearch_url])
        health = await es.cluster.health()
        await es.close()
        
        status = health.get("status", "unknown")
        return {"status": "ok" if status in ["green", "yellow"] else "warning", "message": f"Cluster status: {status}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


async def get_health_status() -> dict[str, Any]:
    """Get comprehensive health status of all services."""
    db_status = await check_database()
    redis_status = await check_redis()
    es_status = await check_elasticsearch()
    
    # Determine overall status
    all_ok = all(
        s["status"] == "ok" 
        for s in [db_status, redis_status, es_status]
    )
    
    return {
        "status": "ok" if all_ok else "degraded",
        "version": "0.2.0",
        "phase": settings.phase,
        "services": {
            "database": db_status,
            "redis": redis_status,
            "elasticsearch": es_status,
        },
    }
