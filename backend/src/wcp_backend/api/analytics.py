from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter()


class DecisionVolume(BaseModel):
    date: str
    total: int
    approved: int
    rejected: int
    in_review: int


class ApprovalRateByTrade(BaseModel):
    trade: str
    approval_rate: float
    total_decisions: int


@router.get("/volume", response_model=list[DecisionVolume])
async def decision_volume(days: int = Query(default=30, le=365)) -> list[DecisionVolume]:
    # TODO: implement — PostgreSQL time-series aggregates
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("/approval-by-trade", response_model=list[ApprovalRateByTrade])
async def approval_by_trade() -> list[ApprovalRateByTrade]:
    # TODO: implement
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("/cost")
async def cost_analytics() -> dict:
    # TODO: implement — per-decision cost aggregation
    raise HTTPException(status_code=501, detail="Not implemented")
