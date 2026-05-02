"""Elasticsearch 8 client + BM25 query helpers."""

from __future__ import annotations

from functools import lru_cache
from typing import Any

from elasticsearch import AsyncElasticsearch

from wcp_backend.config import settings

DBWD_INDEX = "regulation_chunks"


@lru_cache(maxsize=1)
def get_es_client() -> AsyncElasticsearch:
    return AsyncElasticsearch([settings.elasticsearch_url])


async def bm25_search(
    query: str, trade: str | None = None, locality: str | None = None, top_k: int = 10
) -> list[dict[str, Any]]:
    """BM25 full-text search over DBWD regulation chunks."""
    es = get_es_client()

    must_clauses = [{"match": {"text": query}}]
    filter_clauses = []

    if trade:
        filter_clauses.append({"term": {"trade": trade}})
    if locality:
        filter_clauses.append({"term": {"locality": locality}})

    body = {
        "query": {
            "bool": {
                "must": must_clauses,
                "filter": filter_clauses,
            }
        },
        "size": top_k,
    }

    response = await es.search(index=DBWD_INDEX, body=body)

    return [
        {
            "chunk_id": hit["_id"],
            "text": hit["_source"]["text"],
            "score": hit["_score"],
            "metadata": {k: v for k, v in hit["_source"].items() if k != "text"},
        }
        for hit in response["hits"]["hits"]
    ]


async def index_chunk(chunk_id: str, text: str, metadata: dict[str, Any]) -> None:
    """Index a regulation chunk into Elasticsearch."""
    es = get_es_client()
    doc = {"chunk_id": chunk_id, "text": text, **metadata}
    await es.index(index=DBWD_INDEX, id=chunk_id, document=doc)


async def health_check() -> dict[str, Any]:
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
