from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from wcp_backend.pipeline.dbwd_lookup import get_dbwd_rate
router = APIRouter()


class DBWDRate(BaseModel):
    trade: str
    locality: str
    rate: float
    fringe: float
    effective_date: str
    wage_determination_number: str


@router.get("/{trade}/{locality}/{date}", response_model=DBWDRate)
async def get_dbwd_rate_endpoint(trade: str, locality: str, date: str) -> DBWDRate:
    """Get DBWD rate for a specific trade, locality, and effective date."""
    try:
        rate_record = await get_dbwd_rate(trade, locality, date)
        return DBWDRate(
            trade=rate_record.trade,
            locality=rate_record.locality,
            rate=rate_record.rate,
            fringe=rate_record.fringe,
            effective_date=rate_record.effective_date.isoformat(),
            wage_determination_number=rate_record.wage_determination_number
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DBWD lookup failed: {str(e)}")
