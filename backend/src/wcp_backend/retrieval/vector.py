"""Dense vector retrieval via pgvector cosine similarity."""

from __future__ import annotations


async def vector_retrieve(
    query: str, trade: str | None = None, locality: str | None = None, top_k: int = 20
) -> list[dict]:
    """
    1. Embed query via sentence-transformers
    2. cosine similarity search against pgvector embedding column
    3. Filter by trade/locality metadata
    """
    # TODO: implement — embed query → pgvector SELECT ... ORDER BY embedding <=> $1 LIMIT $2
    raise NotImplementedError
