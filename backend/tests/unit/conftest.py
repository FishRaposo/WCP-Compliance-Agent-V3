"""Unit test configuration — mocks external services so no infra is needed."""

from unittest.mock import AsyncMock, MagicMock

import pytest


@pytest.fixture(autouse=True)
def mock_external_services(monkeypatch):
    """Prevent unit tests from connecting to PostgreSQL, Redis, or Phoenix."""
    monkeypatch.setattr("wcp_backend.services.db.init_db", AsyncMock(return_value=None))
    monkeypatch.setattr("wcp_backend.observability.phoenix_setup.init_phoenix", lambda: None)
    monkeypatch.setattr("wcp_backend.services.redis_cache.get_redis", MagicMock())
    monkeypatch.setattr("wcp_backend.services.redis_cache.cache_get", AsyncMock(return_value=None))
    monkeypatch.setattr("wcp_backend.services.redis_cache.cache_set", AsyncMock(return_value=None))
    monkeypatch.setattr("wcp_backend.pipeline.dbwd_lookup._lookup_in_postgres", AsyncMock(return_value=None))
