"""Hybrid RAG orchestrator: BM25 → vector → cross-encoder reranking."""

from __future__ import annotations

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
) -> list[dict]:
    """
    Three-stage retrieval:
    1. BM25 candidate generation (Elasticsearch) → top 20
    2. Dense vector retrieval (pgvector) → top 20
    3. Cross-encoder reranking → top_k final results
    """
    bm25_results = await bm25_retrieve(query, trade=trade, locality=locality, top_k=20)
    vector_results = await vector_retrieve(query, trade=trade, locality=locality, top_k=20)

    candidates = {r["chunk_id"]: r for r in bm25_results + vector_results}.values()
    return await rerank(query, list(candidates), top_k=top_k)
