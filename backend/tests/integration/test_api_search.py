"""Integration tests for search API."""

from __future__ import annotations

import pytest

from wcp_backend.config import settings


@pytest.mark.skipif(settings.phase < 2, reason="Requires Phase 2")
@pytest.mark.asyncio
async def test_search_endpoint_returns_results(client, monkeypatch):
    """POST /search returns regulation chunks."""
    # Mock hybrid_search to avoid ES/pgvector dependencies
    async def mock_hybrid_search(query, trade=None, locality=None, top_k=5):
        return [
            {
                "chunk_id": "test_chunk_1",
                "text": "Test regulation text for electricians",
                "rerank_score": 0.95,
                "metadata": {
                    "trade": "Electrician",
                    "locality": "Washington, DC",
                    "regulation_cite": "40 U.S.C. § 3142"
                }
            }
        ]
    
    monkeypatch.setattr(
        "wcp_backend.api.search.retrieval_hybrid_search",
        mock_hybrid_search
    )
    
    response = client.post(
        "/search",
        json={"query": "electrician wage rate", "trade": "Electrician", "top_k": 5}
    )
    
    assert response.status_code == 200
    results = response.json()
    assert len(results) > 0
    assert "chunk_id" in results[0]
    assert "text" in results[0]
    assert "score" in results[0]


@pytest.mark.skipif(settings.phase < 2, reason="Requires Phase 2")
@pytest.mark.asyncio
async def test_search_endpoint_with_filters(client, monkeypatch):
    """POST /search respects trade and locality filters."""
    received_filters = {}
    
    async def mock_hybrid_search(query, trade=None, locality=None, top_k=5):
        received_filters["trade"] = trade
        received_filters["locality"] = locality
        return []
    
    monkeypatch.setattr(
        "wcp_backend.api.search.retrieval_hybrid_search",
        mock_hybrid_search
    )
    
    response = client.post(
        "/search",
        json={
            "query": "wage determination",
            "trade": "Plumber",
            "locality": "Washington, DC",
            "top_k": 3
        }
    )
    
    assert response.status_code == 200
    assert received_filters["trade"] == "Plumber"
    assert received_filters["locality"] == "Washington, DC"


@pytest.mark.skipif(settings.phase < 2, reason="Requires Phase 2")
@pytest.mark.asyncio
async def test_search_endpoint_empty_results(client, monkeypatch):
    """POST /search handles empty results gracefully."""
    async def mock_hybrid_search(query, trade=None, locality=None, top_k=5):
        return []
    
    monkeypatch.setattr(
        "wcp_backend.api.search.retrieval_hybrid_search",
        mock_hybrid_search
    )
    
    response = client.post(
        "/search",
        json={"query": "nonexistent query xyz123", "top_k": 5}
    )
    
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.skipif(settings.phase < 2, reason="Requires Phase 2")
@pytest.mark.asyncio
async def test_search_endpoint_default_top_k(client, monkeypatch):
    """POST /search uses default top_k=5."""
    received_top_k = None
    
    async def mock_hybrid_search(query, trade=None, locality=None, top_k=5):
        nonlocal received_top_k
        received_top_k = top_k
        return []
    
    monkeypatch.setattr(
        "wcp_backend.api.search.retrieval_hybrid_search",
        mock_hybrid_search
    )
    
    response = client.post("/search", json={"query": "test"})
    
    assert response.status_code == 200
    assert received_top_k == 5
