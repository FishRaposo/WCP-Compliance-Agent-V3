from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

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
    # TODO: implement — BM25 (ES) → vector (pgvector) → cross-encoder reranking
    raise HTTPException(status_code=501, detail="Not implemented")
