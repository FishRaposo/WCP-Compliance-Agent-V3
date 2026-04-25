from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter()


class DecisionSummary(BaseModel):
    decision_id: str
    job_id: str
    verdict: str
    trust_score: float
    created_at: str


@router.get("", response_model=list[DecisionSummary])
async def list_decisions(
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0),
) -> list[DecisionSummary]:
    # TODO: implement — paginated query from PostgreSQL
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("/{decision_id}", response_model=DecisionSummary)
async def get_decision(decision_id: str) -> DecisionSummary:
    # TODO: implement
    raise HTTPException(status_code=501, detail="Not implemented")


@router.post("", response_model=DecisionSummary, status_code=201)
async def persist_decision(decision: dict) -> DecisionSummary:
    # TODO: implement — write audit trail to PostgreSQL
    raise HTTPException(status_code=501, detail="Not implemented")
