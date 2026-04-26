"""Cross-encoder reranking via sentence-transformers."""

from __future__ import annotations

from typing import Any

from sentence_transformers import CrossEncoder

_model: CrossEncoder | None = None
MODEL_NAME = "cross-encoder/ms-marco-MiniLM-L-6-v2"


def get_cross_encoder() -> CrossEncoder:
    global _model
    if _model is None:
        _model = CrossEncoder(MODEL_NAME)
    return _model


async def rerank(query: str, candidates: list[dict[str, Any]], top_k: int = 5) -> list[dict[str, Any]]:
    """Score query-passage pairs and return top_k reranked results."""
    if not candidates:
        return []
    model = get_cross_encoder()
    pairs = [(query, c["text"]) for c in candidates]
    scores = model.predict(pairs)
    ranked = sorted(zip(scores, candidates), key=lambda x: x[0], reverse=True)
    results: list[dict[str, Any]] = []
    for score, item in ranked[:top_k]:
        item["rerank_score"] = float(score)
        results.append(item)
    return results
