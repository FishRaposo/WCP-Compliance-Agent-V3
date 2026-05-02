"""Integration tests for infrastructure connectivity.

Tests verify connectivity to PostgreSQL, Redis, Elasticsearch, and pgvector.
These tests may be skipped locally if services are not running,
but should pass in CI where services are available.
"""

from __future__ import annotations

import os

import pytest

# Skip marker for local development without Docker
REQUIRES_INFRA = pytest.mark.skipif(
    os.getenv("SKIP_INFRA_TESTS", "").lower() in ("1", "true", "yes"),
    reason="Infrastructure tests skipped (SKIP_INFRA_TESTS set)"
)


@REQUIRES_INFRA
async def test_postgres_connection():
    """Verify PostgreSQL connectivity with SELECT 1."""
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine
    from wcp_backend.config import settings
    
    if settings.phase < 2:
        pytest.skip("PostgreSQL not configured (Phase < 2)")
    
    engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            row = result.fetchone()
            assert row is not None
            assert row[0] == 1
    finally:
        await engine.dispose()


@REQUIRES_INFRA
async def test_redis_connection():
    """Verify Redis connectivity with PING."""
    from wcp_backend.config import settings
    from wcp_backend.services.redis_cache import health_check
    
    if settings.phase < 2:
        pytest.skip("Redis not configured (Phase < 2)")
    
    is_healthy = await health_check()
    assert is_healthy, "Redis health check failed"


@REQUIRES_INFRA
async def test_elasticsearch_connection():
    """Verify Elasticsearch cluster health."""
    from wcp_backend.config import settings
    from wcp_backend.services.elasticsearch import health_check
    
    if settings.phase < 2:
        pytest.skip("Elasticsearch not configured (Phase < 2)")
    
    result = await health_check()
    assert result["status"] in ("ok", "warning"), f"ES health check failed: {result}"


@REQUIRES_INFRA
async def test_pgvector_extension():
    """Verify pgvector extension is available."""
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine
    from wcp_backend.config import settings
    
    if settings.phase < 2:
        pytest.skip("pgvector not configured (Phase < 2)")
    
    engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    
    try:
        async with engine.connect() as conn:
            # Check if pgvector extension exists
            result = await conn.execute(text(
                "SELECT 1 FROM pg_extension WHERE extname = 'vector'"
            ))
            row = result.fetchone()
            assert row is not None, "pgvector extension not found"
    finally:
        await engine.dispose()


@REQUIRES_INFRA
async def test_health_endpoint_services():
    """Verify /health endpoint reports all services."""
    from wcp_backend.config import settings
    from wcp_backend.services.health_check import get_health_status
    
    if settings.phase < 2:
        pytest.skip("Phase 2+ required")
    
    health = await get_health_status()
    
    assert "services" in health
    assert health["status"] in ("ok", "degraded")
    
    services = health["services"]
    assert "database" in services
    assert "redis" in services
    assert "elasticsearch" in services
