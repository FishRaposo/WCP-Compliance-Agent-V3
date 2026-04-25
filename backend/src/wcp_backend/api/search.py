from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from wcp_backend.retrieval.hybrid import hybrid_search as retrieval_hybrid_search

router = APIRouter()


class SearchRequest(BaseModel):
    query: str
    trade: str | None = None
    locality: str | None = None
    top_k: int = 5


class SearchResult(BaseModel):
    chunk_id: str
    text: str
    score: float
    trade: str | None = None
    locality: str | None = None
    regulation_cite: str | None = None


@router.post("", response_model=list[SearchResult])
async def hybrid_search(request: SearchRequest) -> list[SearchResult]:
    """Hybrid regulation search combining BM25, vector, and reranking.
    
    Three-stage retrieval:
    1. BM25 candidate generation (Elasticsearch) → top 20
    2. Dense vector retrieval (pgvector) → top 20
    3. Reciprocal Rank Fusion + cross-encoder reranking → top_k final
    
    Args:
        request: SearchRequest with query, optional trade/locality filters, top_k
        
    Returns:
        List of SearchResult with regulation chunks
        
    Raises:
        HTTPException: 500 if retrieval pipeline fails
    """
    try:
        results = await retrieval_hybrid_search(
            query=request.query,
            trade=request.trade,
            locality=request.locality,
            top_k=request.top_k
        )
        
        # Convert to SearchResult models
        return [
            SearchResult(
                chunk_id=r["chunk_id"],
                text=r["text"],
                score=r.get("rerank_score", 0.0),
                trade=r.get("metadata", {}).get("trade"),
                locality=r.get("metadata", {}).get("locality"),
                regulation_cite=r.get("metadata", {}).get("regulation_cite")
            )
            for r in results
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")
