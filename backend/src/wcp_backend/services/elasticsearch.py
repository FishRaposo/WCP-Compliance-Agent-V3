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
