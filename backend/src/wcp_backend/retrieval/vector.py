"""Dense vector retrieval via pgvector cosine similarity."""

from __future__ import annotations

from typing import Any

from sentence_transformers import SentenceTransformer
from sqlalchemy import text

from wcp_backend.services.db import engine

_model: SentenceTransformer | None = None
MODEL_NAME = "all-MiniLM-L6-v2"


def get_embedding_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(MODEL_NAME)
    return _model


async def vector_retrieve(
    query: str, trade: str | None = None, locality: str | None = None, top_k: int = 20
) -> list[dict[str, Any]]:
    """
    1. Embed query via sentence-transformers
    2. cosine similarity search against pgvector embedding column
    3. Filter by trade/locality metadata
    """
    model = get_embedding_model()
    embedding = model.encode(query)
    embedding_str = f"[{','.join(str(x) for x in embedding.tolist())}]"

    # Build query with optional filters
    sql_parts = [
        "SELECT chunk_id, text, trade, locality, regulation_cite,",
        "embedding <=> :embedding::vector(384) AS distance",
        "FROM regulation_chunks",
        "WHERE embedding IS NOT NULL",
    ]
    params: dict[str, Any] = {"embedding": embedding_str, "top_k": top_k}

    if trade:
        sql_parts.append("AND trade = :trade")
        params["trade"] = trade
    if locality:
        sql_parts.append("AND locality = :locality")
        params["locality"] = locality

    sql_parts.append("ORDER BY embedding <=> :embedding::vector(384)")
    sql_parts.append("LIMIT :top_k")

    query_sql = text(" ".join(sql_parts))

    async with engine.connect() as conn:
        result = await conn.execute(query_sql, params)
        rows = result.fetchall()

    return [
        {
            "chunk_id": row.chunk_id,
            "text": row.text,
            "score": 1.0 - row.distance,  # convert distance to similarity
            "metadata": {
                "trade": row.trade,
                "locality": row.locality,
                "regulation_cite": row.regulation_cite,
            },
        }
        for row in rows
    ]
