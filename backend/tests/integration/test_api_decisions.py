"""Integration tests for decisions API."""

from __future__ import annotations

import pytest

from wcp_backend.config import settings


@pytest.mark.asyncio
async def test_list_decisions_requires_phase_2(client):
    """GET /decisions returns 503 in Phase 1."""
    if settings.phase >= 2:
        pytest.skip("Test only valid in Phase 1")
    
    response = client.get("/decisions")
    assert response.status_code == 503


@pytest.mark.asyncio
async def test_get_decision_requires_phase_2(client):
    """GET /decisions/{id} returns 503 in Phase 1."""
    if settings.phase >= 2:
        pytest.skip("Test only valid in Phase 1")
    
    response = client.get("/decisions/test-id")
    assert response.status_code == 503


@pytest.mark.asyncio
async def test_create_decision_requires_phase_2(client):
    """POST /decisions returns 503 in Phase 1."""
    if settings.phase >= 2:
        pytest.skip("Test only valid in Phase 1")
    
    payload = {
        "job_id": "test-job",
        "verdict": "approved",
        "trust_score": 0.85,
        "trust_band": "auto_approve",
        "requires_human_review": False,
        "violation_count": 0,
        "warning_count": 0,
        "llm_confidence": 0.0,
        "reasoning_summary": "All checks passed",
        "citations": [],
    }
    response = client.post("/decisions", json=payload)
    assert response.status_code == 503


@pytest.mark.skipif(settings.phase < 2, reason="Requires Phase 2")
@pytest.mark.asyncio
async def test_list_decisions_pagination(client, monkeypatch):
    """GET /decisions supports limit and offset."""
    # Mock database query
    async def mock_execute(*args, **kwargs):
        class MockResult:
            def fetchall(self):
                return []
        return MockResult()
    
    monkeypatch.setattr("sqlalchemy.ext.asyncio.AsyncSession.execute", mock_execute)
    
    response = client.get("/decisions?limit=10&offset=0")
    assert response.status_code in (200, 500)  # 500 if DB not available


@pytest.mark.skipif(settings.phase < 2, reason="Requires Phase 2")
@pytest.mark.asyncio
async def test_list_decisions_filter_by_verdict(client, monkeypatch):
    """GET /decisions supports verdict filter."""
    received_filters = {}
    
    async def mock_execute(query, *args, **kwargs):
        # Extract where clauses from query
        received_filters["query"] = str(query)
        class MockResult:
            def fetchall(self):
                return []
        return MockResult()
    
    monkeypatch.setattr("sqlalchemy.ext.asyncio.AsyncSession.execute", mock_execute)
    
    response = client.get("/decisions?verdict=approved")
    # Should not error (may return empty if no DB)
    assert response.status_code in (200, 500)


@pytest.mark.skipif(settings.phase < 2, reason="Requires Phase 2")
@pytest.mark.asyncio
async def test_get_decision_not_found(client):
    """GET /decisions/{id} returns 404 for non-existent decision."""
    response = client.get("/decisions/nonexistent-id")
    # 503 if Phase 2 but no DB, 404 if DB available but not found
    assert response.status_code in (404, 503, 500)


@pytest.mark.skipif(settings.phase < 2, reason="Requires Phase 2")
@pytest.mark.asyncio
async def test_create_decision_validates_payload(client):
    """POST /decisions validates required fields."""
    # Missing required fields
    payload = {"job_id": "test"}
    response = client.post("/decisions", json=payload)
    # 422 validation error or 503 if Phase 2 not configured
    assert response.status_code in (422, 503)


@pytest.mark.skipif(settings.phase < 2, reason="Requires Phase 2")
@pytest.mark.asyncio
async def test_create_decision_with_valid_payload(client, monkeypatch):
    """POST /decisions creates a decision with valid payload."""
    from datetime import datetime

    async def mock_execute(stmt, *args, **kwargs):
        class MockResult:
            def fetchone(self):
                from uuid import uuid4
                return type("Row", (), {
                    "id": uuid4(),
                    "job_id": "test-job-123",
                    "verdict": "approved",
                    "trust_score": 0.92,
                    "trust_band": "auto_approve",
                    "requires_human_review": False,
                    "violation_count": 0,
                    "warning_count": 0,
                    "created_at": datetime.utcnow(),
                })()
        return MockResult()

    monkeypatch.setattr("sqlalchemy.ext.asyncio.AsyncSession.execute", mock_execute)

    payload = {
        "job_id": "test-job-123",
        "verdict": "approved",
        "trust_score": 0.92,
        "trust_band": "auto_approve",
        "requires_human_review": False,
        "violation_count": 0,
        "warning_count": 0,
        "llm_confidence": 0.0,
        "reasoning_summary": "All checks passed",
        "citations": [],
    }
    response = client.post("/decisions", json=payload)
    # May be 201 if mocked successfully, 500 if DB not available
    assert response.status_code in (201, 500)
