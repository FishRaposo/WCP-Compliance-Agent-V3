# ADR-002: Hybrid Retrieval (BM25 + Vector + Rerank)

Status: **Accepted**

Date: January 2024

## Context

The WCP Compliance Agent needs to retrieve relevant DBWD (Davis-Bacon Wage Determinations) sections to validate wage compliance. DBWD documents are:
- PDFs with structured tables
- Domain-specific terminology (job titles, localities)
- Versioned (rates change quarterly)
- Require high precision (wrong rate = wrong decision)

We need a retrieval strategy that balances:
- **Precision**: Correct document at top of results
- **Coverage**: Find relevant documents even with terminology variations
- **Latency**: <500ms for retrieval
- **Cost**: Reasonable for production scale

## Decision

**We will use a hybrid retrieval approach combining:**
1. **BM25 (sparse)**: Exact term matching for job titles and localities
2. **Vector (dense)**: Semantic similarity for paraphrases and context
3. **Cross-encoder reranking**: High-precision final ranking

## Rationale

### Why not pure BM25?

**Strengths:**
- Excellent for exact matches ("Electrician")
- Fast (inverted index)
- Interpretable scores

**Weaknesses:**
- Misses synonyms ("Wireman" ≠ "Electrician")
- No semantic understanding
- Struggles with OCR errors

### Why not pure vector?

**Strengths:**
- Captures semantic similarity
- Handles synonyms and paraphrases
- Robust to minor text variations

**Weaknesses:**
- Misses exact term matches
- Can retrieve semantically similar but wrong documents
- Requires embedding model quality

### Why hybrid?

| Query Type | BM25 | Vector | Hybrid |
|------------|------|--------|--------|
| "Electrician rate LA" | ✅ Excellent | ⚠️ OK | ✅ Best |
| "Wireman wage Los Angeles" | ❌ Misses | ✅ Good | ✅ Best |
| "Electrical worker pay" | ⚠️ Partial | ✅ Good | ✅ Best |
| "Elecrician" (typo) | ❌ Misses | ✅ Tolerant | ✅ Best |

**Hybrid gives us the precision of BM25 + the coverage of vector search.**

### Why add cross-encoder reranking?

BM25 and vector retrieval are fast but imprecise at the top-k level. A cross-encoder:
- Scores query-document pairs with full attention
- Much higher precision than embedding similarity
- Slower (O(n) expensive scoring), but we only run on top 50 results

**Tradeoff**: Accept 100-200ms additional latency for significantly better precision.

## Architecture

```
Query: "Electrician prevailing wage Los Angeles"
              │
              ▼
┌─────────────────────────────┐
│      Parallel Search        │
├─────────────┬───────────────┤
│             │               │
▼             ▼               ▼
BM25       Vector         (Future: Graph)
│             │               │
│             │               │
└─────────────┴───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  Reciprocal Rank Fusion     │
│  (RRF) Score Combination    │
└─────────────────────────────┘
              │
              ▼
┌─────────────────────────────┐
│    Top 50 Candidates        │
└─────────────────────────────┘
              │
              ▼
┌─────────────────────────────┐
│  Cross-Encoder Reranking    │
│  (Higher precision scoring) │
└─────────────────────────────┘
              │
              ▼
┌─────────────────────────────┐
│    Final Top 10 Results       │
│    with Citations             │
└─────────────────────────────┘
```

## Implementation plan

### Phase 1: BM25 (Current)

- Elasticsearch or Meilisearch for inverted index
- Fields: job_title, locality, content
- Query expansion for synonyms (manual mapping)

### Phase 2: Vector (MVP)

- pgvector extension in PostgreSQL
- Embedding model: OpenAI text-embedding-3-small
- Store vectors alongside BM25 index

### Phase 3: Fusion

- Reciprocal Rank Fusion (RRF) for combining scores
- k=60 constant (standard RRF parameter)
- Fallback to single-method if other fails

### Phase 4: Reranking

- Cross-encoder model (ms-marco-MiniLM-L-6-v2 or similar)
- Batch scoring for efficiency
- Confidence threshold for escalation

## Technical details

### Reciprocal Rank Fusion

```typescript
function reciprocalRankFusion(
  bm25Results: SearchResult[],
  vectorResults: SearchResult[],
  k: number = 60
): FusedResult[] {
  const scores = new Map<string, number>();
  
  // Score BM25 results
  bm25Results.forEach((result, index) => {
    const current = scores.get(result.id) || 0;
    scores.set(result.id, current + 1 / (k + index + 1));
  });
  
  // Score vector results
  vectorResults.forEach((result, index) => {
    const current = scores.get(result.id) || 0;
    scores.set(result.id, current + 1 / (k + index + 1));
  });
  
  // Sort by fused score
  return Array.from(scores.entries())
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}
```

### Cross-encoder reranking

```typescript
async function rerankWithCrossEncoder(
  query: string,
  candidates: Document[],
  model: CrossEncoder
): Promise<RerankedResult[]> {
  // Prepare pairs for scoring
  const pairs = candidates.map(doc => ({
    query,
    document: doc.content.slice(0, 512), // Truncate for efficiency
  }));
  
  // Batch score (more efficient than individual calls)
  const scores = await model.scoreBatch(pairs);
  
  // Attach scores and sort
  return candidates
    .map((doc, i) => ({ ...doc, relevanceScore: scores[i] }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}
```

## Tradeoffs

### Latency budget

| Stage | Time | Cumulative |
|-------|------|------------|
| BM25 search | 50ms | 50ms |
| Vector search | 100ms | 150ms |
| Fusion | 5ms | 155ms |
| Fetch top-50 | 20ms | 175ms |
| Reranking | 200ms | 375ms |
| **Total** | | **< 500ms** |

### Cost per query

| Component | Cost | Notes |
|-----------|------|-------|
| BM25 (ES) | $0.0001 | Small instance |
| Vector (pgvector) | $0.00005 | Local compute |
| Reranking | $0.0005 | GPU inference |
| **Total** | **~$0.0007** | Negligible at scale |

## Alternatives considered

### Pure Elasticsearch (BM25 only)

- Simpler deployment
- Faster (no vector search)
- Would miss semantic matches and synonyms

**Verdict**: Rejected—coverage too limited.

### Pure vector (pgvector only)

- Single database (simpler)
- Good semantic matches
- Would miss exact term matches, job title precision

**Verdict**: Rejected—precision insufficient for compliance.

### ColBERT (late interaction)

- Higher retrieval quality than cross-encoder
- Faster than cross-encoder reranking
- More complex deployment (custom index)
- Overkill for our document volume (~10K determinations)

**Verdict**: Future consideration, not MVP.

### Managed retrieval (Pinecone + Cohere)

- Fully managed, easy setup
- Higher cost at scale
- Vendor lock-in
- Less control over ranking

**Verdict**: Rejected—want infrastructure control.

## Metrics for success

| Metric | Target | Measurement |
|--------|--------|-------------|
| MRR @ 1 | > 0.7 | Mean reciprocal rank of first relevant doc |
| Recall @ 5 | > 0.9 | % of relevant docs in top 5 |
| Latency P95 | < 500ms | End-to-end retrieval time |
| Synonym accuracy | > 0.85 | "Wireman" → "Electrician" correct |

## References

- [Reciprocal Rank Fusion paper](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf)
- [Cross-encoders explained](https://www.sbert.net/examples/applications/cross-encoder/README.html)
- [pgvector documentation](https://github.com/pgvector/pgvector)
- [BM25 algorithm](https://www.elastic.co/blog/practical-bm25-part-2-the-bm25-algorithm-and-its-variables)

## Status

- **Proposed**: January 2024
- **Accepted**: January 2024
- **Last reviewed**: January 2024

---

**Implementation Status**: Designed / Target

**Documentation**: 
- `docs/implementation/05-retrieval-hybrid-rerank.md` — Full implementation guide
- `docs/implementation/04-vector-pgvector.md` — Vector storage details
- `docs/implementation/02-search-elasticsearch.md` — BM25 search setup

**Code**: Not yet implemented (stubbed)
