from fastapi import APIRouter, HTTPException

from wcp_backend.models.schemas import DeterministicReport, ExtractedWCP
from wcp_backend.pipeline.rules import run_rule_engine

router = APIRouter()


@router.post("", response_model=DeterministicReport)
async def validate_wcp(extracted: ExtractedWCP) -> DeterministicReport:
    """Run deterministic compliance checks on extracted WCP data."""
    try:
        return await run_rule_engine(extracted)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Validation failed: {str(e)}")
