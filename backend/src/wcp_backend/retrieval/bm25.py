"""BM25 candidate generation via Elasticsearch."""

from __future__ import annotations

from wcp_backend.services.elasticsearch import bm25_search


async def bm25_retrieve(
    query: str, trade: str | None = None, locality: str | None = None, top_k: int = 20
) -> list[dict]:
    """Return BM25 candidates from Elasticsearch DBWD index."""
    return await bm25_search(query, trade=trade, locality=locality, top_k=top_k)
