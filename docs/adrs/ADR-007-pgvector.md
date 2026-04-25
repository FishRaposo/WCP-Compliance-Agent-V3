# ADR-007: pgvector over Dedicated Vector DB

**Status:** Accepted

**Date:** 2026-04-22

**Author:** Vinícius Raposo

---

## Context

The AI compliance system requires vector search for RAG. Options:
1. **Dedicated vector DB:** Pinecone, Weaviate, Chroma, Milvus
2. **PostgreSQL + pgvector:** One DB for relational + vector

---

## Decision

Use **PostgreSQL 16 + pgvector extension** for vector storage and similarity search.

---

## Rationale

**Pragmatism:**
- One less service to operate (already need PostgreSQL for relational data)
- Single transaction for relational + vector writes (atomicity)
- ACID compliance for decision + embedding storage

**Cost:**
- pgvector is free (open source)
- Dedicated vector DBs charge by dimension count or query volume

**Key Insight:**
- "Why run a separate vector DB when PostgreSQL handles it?"
- Demonstrates production pragmatism over architectural over-engineering

---

## Technical Capabilities

pgvector supports:
- L2 distance (Euclidean)
- Inner product
- Cosine similarity (our use case)
- L1 distance
- Hamming distance
- Index types: ivfflat, hnsw (hnsw preferred for speed)

---

## Schema

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE dbwd_chunks (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    embedding VECTOR(1536),  -- text-embedding-3-small
    trade_code VARCHAR(50),
    locality VARCHAR(100),
    effective_date DATE,
    metadata JSONB
);

-- HNSW index for fast approximate nearest neighbor
CREATE INDEX ON dbwd_chunks USING hnsw (embedding vector_cosine_ops);
```

---

## When NOT to Use pgvector

| Scenario | Better Alternative |
|---|---|
| Billion-scale vectors | Pinecone, Weaviate (specialized)
| Multi-tenant isolation requirements | Separate vector DB per tenant |
| Heavy write load + read load | Separate services (CQRS pattern) |

For WCP compliance (thousands of DBWD rates, not billions), pgvector is sufficient.

---

## Integration

```python
# backend/src/retrieval/vector.py
from pgvector.asyncpg import register_vector
import asyncpg

async def vector_search(query_embedding: list[float], k: int = 10):
    conn = await asyncpg.connect(DATABASE_URL)
    await register_vector(conn)
    
    rows = await conn.fetch(
        """
        SELECT id, content, trade_code, locality,
               1 - (embedding <=> $1) AS similarity
        FROM dbwd_chunks
        ORDER BY embedding <=> $1
        LIMIT $2
        """,
        query_embedding,
        k
    )
    return rows
```

---

## Consequences

**Positive:**
- One service instead of two
- ACID transactions across relational + vector
- Lower operational complexity
- Strong justification: "Production pragmatism"

**Negative:**
- pgvector is slower than specialized vector DBs at scale
- PostgreSQL resource contention (CPU for vector ops + SQL queries)
- Limited to 16000 dimensions per vector (sufficient for our use case)

---

## Related

- ADR-005: Hybrid RAG (pgvector is the vector component)
- ADR-008: redis.asyncio (Redis handles caching, not vector storage)
