"""Elasticsearch 8 client + BM25 query helpers."""

from __future__ import annotations

from elasticsearch import AsyncElasticsearch

from wcp_backend.config import settings

_client: AsyncElasticsearch | None = None
DBWD_INDEX = "dbwd_regulations"


def get_es_client() -> AsyncElasticsearch:
    global _client
    if _client is None:
        _client = AsyncElasticsearch([settings.elasticsearch_url])
    return _client


async def bm25_search(query: str, trade: str | None = None, locality: str | None = None, top_k: int = 10) -> list[dict]:
    """BM25 full-text search over DBWD regulation chunks."""
    # TODO: implement ES query with optional trade/locality filters
    raise NotImplementedError


async def index_chunk(chunk_id: str, text: str, metadata: dict) -> None:
    """Index a regulation chunk into Elasticsearch."""
    # TODO: implement
    raise NotImplementedError


async def health_check() -> dict:
    """Check Elasticsearch cluster health.
    
    Returns:
        dict with status: 'ok', 'warning', or 'error'
    """
    try:
        client = get_es_client()
        health = await client.cluster.health()
        status = health.get("status", "unknown")
        
        if status in ("green", "yellow"):
            return {"status": "ok", "cluster_status": status}
        elif status == "red":
            return {"status": "warning", "cluster_status": status}
        else:
            return {"status": "error", "cluster_status": status}
    except Exception as e:
        return {"status": "error", "message": str(e)}
