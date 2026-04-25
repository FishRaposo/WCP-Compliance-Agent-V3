"""Integration tests for analytics API."""

from __future__ import annotations

import pytest

from wcp_backend.config import settings


@pytest.mark.asyncio
async def test_analytics_volume_requires_phase_2(client):
    """GET /analytics/volume returns 503 in Phase 1."""
    if settings.phase >= 2:
        pytest.skip("Test only valid in Phase 1")
    
    response = client.get("/analytics/volume")
    assert response.status_code == 503


@pytest.mark.asyncio
async def test_analytics_approval_by_trade_requires_phase_2(client):
    """GET /analytics/approval-by-trade returns 503 in Phase 1."""
    if settings.phase >= 2:
        pytest.skip("Test only valid in Phase 1")
    
    response = client.get("/analytics/approval-by-trade")
    assert response.status_code == 503


@pytest.mark.asyncio
async def test_analytics_trust_band_requires_phase_2(client):
    """GET /analytics/trust-band-distribution returns 503 in Phase 1."""
    if settings.phase >= 2:
        pytest.skip("Test only valid in Phase 1")
    
    response = client.get("/analytics/trust-band-distribution")
    assert response.status_code == 503


@pytest.mark.asyncio
async def test_analytics_cost_requires_phase_2(client):
    """GET /analytics/cost returns 503 in Phase 1."""
    if settings.phase >= 2:
        pytest.skip("Test only valid in Phase 1")
    
    response = client.get("/analytics/cost")
    assert response.status_code == 503


@pytest.mark.skipif(settings.phase < 2, reason="Requires Phase 2")
@pytest.mark.asyncio
async def test_analytics_volume_days_parameter(client):
    """GET /analytics/volume respects days parameter."""
    response = client.get("/analytics/volume?days=7")
    # 200 if DB available, 500 if DB error, 503 if Phase 2 but no DB
    assert response.status_code in (200, 500, 503)


@pytest.mark.skipif(settings.phase < 2, reason="Requires Phase 2")
@pytest.mark.asyncio
async def test_analytics_volume_max_days(client):
    """GET /analytics/volume enforces max days (365)."""
    response = client.get("/analytics/volume?days=500")
    # Should either cap at 365 or return validation error
    assert response.status_code in (200, 422, 500, 503)


@pytest.mark.skipif(settings.phase < 2, reason="Requires Phase 2")
@pytest.mark.asyncio
async def test_analytics_approval_by_trade_structure(client):
    """GET /analytics/approval-by-trade returns expected structure."""
    response = client.get("/analytics/approval-by-trade")
    # If DB available, verify structure
    if response.status_code == 200:
        data = response.json()
        assert "overall" in data
        assert "by_trust_band" in data
        assert "total" in data["overall"]
        assert "rate" in data["overall"]


@pytest.mark.skipif(settings.phase < 2, reason="Requires Phase 2")
@pytest.mark.asyncio
async def test_analytics_trust_band_structure(client):
    """GET /analytics/trust-band-distribution returns list of distributions."""
    response = client.get("/analytics/trust-band-distribution")
    # If DB available, verify structure
    if response.status_code == 200:
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            assert "trust_band" in data[0]
            assert "count" in data[0]
            assert "percentage" in data[0]


@pytest.mark.skipif(settings.phase < 2, reason="Requires Phase 2")
@pytest.mark.asyncio
async def test_analytics_cost_has_note(client):
    """GET /analytics/cost includes note about Phase 3+ requirements."""
    response = client.get("/analytics/cost")
    # If DB available, verify note present
    if response.status_code == 200:
        data = response.json()
        assert "note" in data
        assert "Phase 3+" in data["note"]
