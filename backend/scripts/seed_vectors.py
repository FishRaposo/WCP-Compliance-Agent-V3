"""Generate embeddings for regulation chunks and store in pgvector."""

from __future__ import annotations

import asyncio

from elasticsearch import AsyncElasticsearch
from sqlalchemy.ext.asyncio import create_async_engine

from wcp_backend.config import settings


import sys
from pathlib import Path

# Ensure scripts/ is on sys.path for relative imports when run standalone
_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

# Import seed data from seed_elasticsearch
from seed_elasticsearch import INDEX_NAME  # noqa: E402


def generate_simple_embedding(text: str, dim: int = 384) -> list[float]:
    """Generate a deterministic pseudo-embedding for testing.
    
    In production, this would use sentence-transformers or OpenAI embeddings.
    For Phase 2, we use a simple hash-based embedding for testing.
    """
    import hashlib
    
    # Create deterministic embedding from text hash
    hash_bytes = hashlib.md5(text.encode()).digest()
    embedding = []
    for i in range(dim):
        # Use hash bytes to generate values between -1 and 1
        val = (hash_bytes[i % len(hash_bytes)] / 255.0) * 2 - 1
        embedding.append(val)
    
    # Normalize
    import math
    norm = math.sqrt(sum(x * x for x in embedding))
    if norm > 0:
        embedding = [x / norm for x in embedding]
    
    return embedding


async def seed() -> int:
    """Generate embeddings for regulation chunks and store in pgvector.
    
    Returns:
        Number of embeddings stored.
    """
    # Load chunks from Elasticsearch
    es = AsyncElasticsearch([settings.elasticsearch_url])
    
    try:
        # Search for all chunks
        response = await es.search(
            index=INDEX_NAME,
            body={"query": {"match_all": {}}, "size": 100}
        )
        
        chunks = []
        for hit in response["hits"]["hits"]:
            source = hit["_source"]
            chunks.append({
                "chunk_id": source["chunk_id"],
                "text": source["text"],
                "trade": source["trade"],
                "locality": source["locality"],
                "regulation_cite": source["regulation_cite"],
                "wage_determination_number": source["wage_determination_number"],
            })
        
        if not chunks:
            print("No chunks found in Elasticsearch. Run seed_elasticsearch.py first.")
            return 0
        
        print(f"Found {len(chunks)} chunks to embed")
    finally:
        await es.close()
    
    # Store embeddings in pgvector
    from sqlalchemy import sql
    
    engine = create_async_engine(settings.database_url)
    
    stored = 0
    async with engine.connect() as conn:
        for chunk in chunks:
            try:
                # Generate embedding
                embedding = generate_simple_embedding(chunk["text"])
                embedding_str = f"[{','.join(str(x) for x in embedding)}]"
                
                # Insert with raw SQL for vector type
                await conn.execute(sql.text("""
                    INSERT INTO regulation_chunks 
                    (chunk_id, text, trade, locality, regulation_cite, wage_determination_number, embedding)
                    VALUES (:chunk_id, :text, :trade, :locality, :regulation_cite, :wage_determination_number, CAST(:embedding AS vector(384)))
                    ON CONFLICT (chunk_id) DO NOTHING
                """), {
                    "chunk_id": chunk["chunk_id"],
                    "text": chunk["text"],
                    "trade": chunk["trade"],
                    "locality": chunk["locality"],
                    "regulation_cite": chunk["regulation_cite"],
                    "wage_determination_number": chunk["wage_determination_number"],
                    "embedding": embedding_str
                })
                stored += 1
                print(f"Stored embedding for {chunk['chunk_id']}")
            except Exception as e:
                print(f"Warning: Could not store embedding for {chunk['chunk_id']}: {e}")  # noqa: T201
                # Non-fatal: continue with other chunks
        
        await conn.commit()
    
    await engine.dispose()
    print(f"Stored {stored} embeddings in pgvector")
    return stored


if __name__ == "__main__":
    asyncio.run(seed())
