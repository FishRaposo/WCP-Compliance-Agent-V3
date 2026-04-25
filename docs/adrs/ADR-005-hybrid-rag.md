# ADR-005: Hybrid RAG (BM25 + Vector + Cross-Encoder Reranking)

**Status:** Accepted

**Date:** 2026-04-22

**Author:** Vinícius Raposo

---

## Context

The AI compliance system requires hybrid search combining lexical matching, semantic similarity, and precision reranking.

The WCP compliance system needs to retrieve Davis-Bacon Wage Determinations (DBWD) for validation:
- Given: trade (Electrician), locality (Boston, MA), date
- Retrieve: prevailing wage rate, fringe benefits, effective date

---

## Decision

Implement three-stage hybrid retrieval:

1. **Candidate Generation** (parallel)
   - Elasticsearch BM25: lexical match on trade name, locality
   - pgvector: semantic similarity on trade descriptions
2. **Fusion**: Reciprocal Rank Fusion (RRF) to combine scores
3. **Reranking**: Cross-encoder (sentence-transformers) for final ranking

---

## Rationale

**Search Requirement:**
- Lexical matching for exact terms (BM25)
- Semantic similarity for conceptual matches (vector)
- Precision reranking for final selection (cross-encoder)

**Technical Necessity:**

| Stage | Why |
|---|---|
| **BM25** | Exact match on trade codes, locality names. "Electrician" must find "Electrician", not semantically similar trades. |
| **Vector** | Handles typos, synonyms, outdated trade names. "Sparky" might vector-match to "Electrician." |
| **Cross-encoder** | Final quality filter. Bi-encoders (vector DB) are fast but less accurate. Cross-encoder reranks top-20 with full context. |

**Why Not Just One?**
- BM25 only: misses semantic matches
- Vector only: misses exact keyword matches
- Neither: needs reranker for precision

---

## Architecture

```python
# backend/src/retrieval/hybrid.py

async def hybrid_search(query: str, trade: str, locality: str) -> List[DBWDRecord]:
    # Stage 1: Parallel candidate generation
    bm25_results = await bm25_search(trade, locality, k=50)
    vector_results = await vector_search(query, k=50)
    
    # Stage 2: RRF fusion
    fused = reciprocal_rank_fusion(bm25_results, vector_results, k=60)
    
    # Stage 3: Cross-encoder reranking
    reranked = await cross_encoder_rerank(fused[:20], query)
    
    return reranked[:10]
```

---

## Implementation

| Component | Technology | Location |
|---|---|---|
| BM25 | Elasticsearch 8 | Docker service `elasticsearch` |
| Vector | pgvector extension | PostgreSQL 16 |
| Embeddings | text-embedding-3-small | OpenAI API |
| Cross-encoder | sentence-transformers | `cross-encoder/ms-marco-MiniLM-L-6-v2` |

---

## Chunking Strategy

For DBWD rates, use **domain-aware chunking**:

```python
# Chunk by: trade_code × locality × effective_date
# Each chunk: ~200 tokens with metadata
{
    "content": "Electrician, Boston MA, $51.69/hr base + $34.63 fringe...",
    "metadata": {
        "trade_code": "ELEC",
        "locality": "Boston-Cambridge-Quincy, MA-NH",
        "effective_date": "2024-06-01",
        "wage_determination_id": "DBWD-2024-MA-BOS-001"
    }
}
```

---

## Consequences

**Positive:**
- Optimal retrieval performance for compliance domain
- State-of-the-art RAG (production-grade)
- Demonstrates deep retrieval knowledge

**Negative:**
- Three services to maintain (ES, PG+pgvector, Python reranker)
- Higher latency than single-stage retrieval

**Mitigation:**
- Cache top-100 trade×locality combos in Redis
- Reranking is CPU-bound but fast (<100ms for top-20)

---

## Related

- ADR-006: Celery for Async Task Queue (background RAG for batch processing)
- ADR-007: pgvector over dedicated vector DB
