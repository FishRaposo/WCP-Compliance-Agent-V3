import logging
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    Integer,
    MetaData,
    Table,
    Text,
    desc,
    func,
    select,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PgUUID

from wcp_backend.config import settings
from wcp_backend.services.db import async_session

logger = logging.getLogger(__name__)
router = APIRouter()

# Inline table definition matching migration 001
decisions_table = Table(
    "decisions",
    MetaData(),
    Column("id", PgUUID(), primary_key=True),
    Column("verdict", Text(), nullable=False),
    Column("trust_score", Float(), nullable=False),
    Column("trust_band", Text(), nullable=False),
    Column("requires_human_review", Boolean(), nullable=False, server_default="false"),
    Column("violation_count", Integer(), nullable=False, server_default="0"),
    Column("warning_count", Integer(), nullable=False, server_default="0"),
    Column("reasoning_summary", Text(), nullable=True),
    Column("citations", JSONB(), nullable=True, server_default="[]"),
    Column("cost_usd", Float(), nullable=True),
    Column("latency_ms", Integer(), nullable=True),
    Column("phoenix_trace_id", Text(), nullable=True),
    Column("created_at", DateTime(timezone=True), nullable=False),
)


class DecisionVolume(BaseModel):
    date: str
    count: int


class ApprovalRateByTrade(BaseModel):
    trust_band: str
    total: int
    approved: int
    rate: float


class TrustBandDistribution(BaseModel):
    trust_band: str
    count: int
    percentage: float


class CostAnalytics(BaseModel):
    total_decisions: int
    decisions_this_month: int
    note: str


@router.get("/volume", response_model=list[DecisionVolume])
async def decision_volume(
    days: int = Query(default=30, le=365)
) -> list[DecisionVolume]:
    """Get decision volume by date."""
    if settings.phase < 2:
        raise HTTPException(
            status_code=503, detail="Analytics API requires Phase 2 (PostgreSQL)"
        )

    try:
        async with async_session() as session:
            start_date = datetime.utcnow() - timedelta(days=days)

            query = (
                select(
                    func.date_trunc("day", decisions_table.c.created_at).label("date"),
                    func.count().label("cnt"),
                )
                .where(decisions_table.c.created_at >= start_date)
                .group_by(func.date_trunc("day", decisions_table.c.created_at))
                .order_by(desc("date"))
            )

            result = await session.execute(query)
            rows = result.fetchall()

            return [
                DecisionVolume(
                    date=row.date.isoformat()
                    if hasattr(row.date, "isoformat")
                    else str(row.date),
                    count=row.cnt,
                )
                for row in rows
            ]
    except Exception:
        logger.exception("decision_volume failed")
        raise HTTPException(status_code=500, detail="Database error")


@router.get("/approval-by-trade", response_model=dict)
async def approval_by_trade() -> dict[str, Any]:
    """Get approval rates by trust band."""
    if settings.phase < 2:
        raise HTTPException(
            status_code=503, detail="Analytics API requires Phase 2 (PostgreSQL)"
        )

    try:
        async with async_session() as session:
            total_query = select(func.count().label("total"))
            approved_query = select(func.count().label("approved")).where(
                decisions_table.c.verdict == "approved"
            )

            total_result = await session.execute(total_query)
            approved_result = await session.execute(approved_query)

            total = total_result.scalar() or 0
            approved = approved_result.scalar() or 0

            band_query = (
                select(
                    decisions_table.c.trust_band,
                    func.count().label("cnt"),
                    func.sum(
                        func.case(
                            (decisions_table.c.verdict == "approved", 1),
                            else_=0,
                        )
                    ).label("approved_count"),
                )
                .group_by(decisions_table.c.trust_band)
            )

            band_result = await session.execute(band_query)
            band_rows = band_result.fetchall()

            by_trust_band = [
                {
                    "trust_band": row.trust_band,
                    "total": row.cnt,
                    "approved": row.approved_count or 0,
                    "rate": round((row.approved_count or 0) / row.cnt, 4)
                    if row.cnt > 0
                    else 0.0,
                }
                for row in band_rows
            ]

            return {
                "overall": {
                    "total": total,
                    "approved": approved,
                    "rate": round(approved / total, 4) if total > 0 else 0.0,
                },
                "by_trust_band": by_trust_band,
            }
    except Exception:
        logger.exception("approval_by_trade failed")
        raise HTTPException(status_code=500, detail="Database error")


@router.get("/trust-band-distribution", response_model=list[TrustBandDistribution])
async def trust_band_distribution() -> list[TrustBandDistribution]:
    """Get distribution of decisions by trust band."""
    if settings.phase < 2:
        raise HTTPException(
            status_code=503, detail="Analytics API requires Phase 2 (PostgreSQL)"
        )

    try:
        async with async_session() as session:
            total_query = select(func.count().label("total"))
            total_result = await session.execute(total_query)
            total = total_result.scalar() or 1

            query = (
                select(
                    decisions_table.c.trust_band,
                    func.count().label("cnt"),
                )
                .group_by(decisions_table.c.trust_band)
            )

            result = await session.execute(query)
            rows = result.fetchall()

            return [
                TrustBandDistribution(
                    trust_band=row.trust_band,
                    count=row.cnt,
                    percentage=round((row.cnt / total) * 100, 2),
                )
                for row in rows
            ]
    except Exception:
        logger.exception("trust_band_distribution failed")
        raise HTTPException(status_code=500, detail="Database error")


@router.get("/cost", response_model=CostAnalytics)
async def cost_analytics() -> CostAnalytics:
    """Get cost analytics placeholder."""
    if settings.phase < 2:
        raise HTTPException(
            status_code=503, detail="Analytics API requires Phase 2 (PostgreSQL)"
        )

    try:
        async with async_session() as session:
            total_query = select(func.count().label("total"))
            total_result = await session.execute(total_query)
            total_row = total_result.fetchone()

            month_query = (
                select(func.count().label("monthly"))
                .where(
                    decisions_table.c.created_at
                    >= datetime.utcnow() - timedelta(days=30)
                )
            )
            month_result = await session.execute(month_query)
            month_row = month_result.fetchone()

            return CostAnalytics(
                total_decisions=total_row.total if total_row is not None else 0,
                decisions_this_month=month_row.monthly if month_row is not None else 0,
                note="Detailed cost tracking requires LLM token logging (Phase 3+)",
            )
    except Exception:
        logger.exception("cost_analytics failed")
        raise HTTPException(status_code=500, detail="Database error")
