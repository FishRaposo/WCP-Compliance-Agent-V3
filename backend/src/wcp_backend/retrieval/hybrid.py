"""Hybrid RAG orchestrator: BM25 -> vector -> cross-encoder reranking."""

from __future__ import annotations

from typing import Any

from wcp_backend.observability.tracing import trace_span
from wcp_backend.retrieval.bm25 import bm25_retrieve
from wcp_backend.retrieval.cross_encoder import rerank
from wcp_backend.retrieval.vector import vector_retrieve


@trace_span("hybrid_search", attributes={"component": "retrieval"})
async def hybrid_search(
    query: str,
    trade: str | None = None,
    locality: str | None = None,
    top_k: int = 5,
) -> list[dict[str, Any]]:
    """
    Three-stage retrieval:
    1. BM25 candidate generation (Elasticsearch) -> top 20
    2. Dense vector retrieval (pgvector) -> top 20
    3. Reciprocal Rank Fusion + cross-encoder reranking -> top_k final results
    """
    bm25_results = await bm25_retrieve(
        query, trade=trade, locality=locality, top_k=20
    )
    vector_results = await vector_retrieve(
        query, trade=trade, locality=locality, top_k=20
    )

    merged = _rrf_merge(bm25_results, vector_results)
    return await rerank(query, merged, top_k=top_k)


def _rrf_merge(bm25: list[dict[str, Any]], vector: list[dict[str, Any]], k: int = 60) -> list[dict[str, Any]]:
    """Reciprocal Rank Fusion: score = sum(1/(k + rank)) for each result in each list."""
    scores: dict[str, float] = {}
    data: dict[str, dict[str, Any]] = {}

    for rank, result in enumerate(bm25):
        doc_id = result.get("chunk_id", result.get("text", ""))
        scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rank + 1)
        data[doc_id] = result

    for rank, result in enumerate(vector):
        doc_id = result.get("chunk_id", result.get("text", ""))
        scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rank + 1)
        data[doc_id] = result

    sorted_ids = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)
    return [data[doc_id] for doc_id in sorted_ids]
