from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from wcp_backend.config import settings

router = APIRouter()

# Database session factory
engine = create_async_engine(settings.database_url, pool_pre_ping=True)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class DecisionVolume(BaseModel):
    date: str
    count: int


class ApprovalRateByTrade(BaseModel):
    trade: str
    total: int
    approved: int
    rate: float


class TrustBandDistribution(BaseModel):
    trust_band: str
    count: int
    percentage: float


@router.get("/volume", response_model=list[DecisionVolume])
async def decision_volume(days: int = Query(default=30, le=365)) -> list[DecisionVolume]:
    """Get decision volume by date.

    Args:
        days: Number of days to look back (default 30, max 365)

    Returns:
        List of DecisionVolume by date

    Raises:
        HTTPException: 503 if Phase < 2
    """
    if settings.phase < 2:
        raise HTTPException(status_code=503, detail="Analytics API requires Phase 2 (PostgreSQL)")

    try:
        from sqlalchemy import Table, Column, MetaData, Text, DateTime, Numeric
        from sqlalchemy.dialects.postgresql import UUID as PgUUID
        from sqlalchemy import sql
        from sqlalchemy import func

        metadata = MetaData()

        decisions = Table(
            'decisions',
            metadata,
            Column('id', PgUUID(), primary_key=True, server_default=sql.text('gen_random_uuid()')),
            Column('verdict', Text(), nullable=False),
            Column('trust_score', Numeric(precision=5, scale=4), nullable=False),
            Column('trust_band', Text(), nullable=False),
            Column('created_at', DateTime(timezone=True), nullable=False, server_default=sql.text('NOW()')),
        )

        async with async_session() as session:
            # Calculate date range
            start_date = datetime.utcnow() - timedelta(days=days)

            # Group by date and count
            query = select(
                func.date_trunc('day', decisions.c.created_at).label('date'),
                func.count().label('count')
            ).where(
                decisions.c.created_at >= start_date
            ).group_by(
                func.date_trunc('day', decisions.c.created_at)
            ).order_by(desc('date'))

            result = await session.execute(query)
            rows = result.fetchall()

            return [
                DecisionVolume(
                    date=row.date.isoformat() if hasattr(row.date, 'isoformat') else str(row.date),
                    count=row.count
                )
                for row in rows
            ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.get("/approval-by-trade", response_model=dict)
async def approval_by_trade() -> dict:
    """Get approval rates by trade.

    Returns:
        Dict with overall stats and breakdown by trade

    Raises:
        HTTPException: 503 if Phase < 2
    """
    if settings.phase < 2:
        raise HTTPException(status_code=503, detail="Analytics API requires Phase 2 (PostgreSQL)")

    try:
        from sqlalchemy import Table, Column, MetaData, Text, DateTime, Numeric
        from sqlalchemy.dialects.postgresql import UUID as PgUUID
        from sqlalchemy import sql
        from sqlalchemy import func, case

        metadata = MetaData()

        decisions = Table(
            'decisions',
            metadata,
            Column('id', PgUUID(), primary_key=True, server_default=sql.text('gen_random_uuid()')),
            Column('verdict', Text(), nullable=False),
            Column('trust_score', Numeric(precision=5, scale=4), nullable=False),
            Column('trust_band', Text(), nullable=False),
            Column('created_at', DateTime(timezone=True), nullable=False, server_default=sql.text('NOW()')),
        )

        async with async_session() as session:
            # Overall stats
            total_query = select(func.count().label('total'))
            approved_query = select(func.count().label('approved')).where(decisions.c.verdict == 'approved')

            total_result = await session.execute(total_query)
            approved_result = await session.execute(approved_query)

            total = total_result.scalar() or 0
            approved = approved_result.scalar() or 0

            # By trust band
            band_query = select(
                decisions.c.trust_band,
                func.count().label('count'),
                func.sum(case((decisions.c.verdict == 'approved', 1), else_=0)).label('approved_count')
            ).group_by(decisions.c.trust_band)

            band_result = await session.execute(band_query)
            band_rows = band_result.fetchall()

            by_trust_band = [
                {
                    "trust_band": row.trust_band,
                    "total": row.count,
                    "approved": row.approved_count or 0,
                    "rate": round((row.approved_count or 0) / row.count, 4) if row.count > 0 else 0.0
                }
                for row in band_rows
            ]

            return {
                "overall": {
                    "total": total,
                    "approved": approved,
                    "rate": round(approved / total, 4) if total > 0 else 0.0
                },
                "by_trust_band": by_trust_band
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.get("/trust-band-distribution", response_model=list[TrustBandDistribution])
async def trust_band_distribution() -> list[TrustBandDistribution]:
    """Get distribution of decisions by trust band.

    Returns:
        List of TrustBandDistribution

    Raises:
        HTTPException: 503 if Phase < 2
    """
    if settings.phase < 2:
        raise HTTPException(status_code=503, detail="Analytics API requires Phase 2 (PostgreSQL)")

    try:
        from sqlalchemy import Table, Column, MetaData, Text, DateTime, Numeric
        from sqlalchemy.dialects.postgresql import UUID as PgUUID
        from sqlalchemy import sql
        from sqlalchemy import func

        metadata = MetaData()

        decisions = Table(
            'decisions',
            metadata,
            Column('id', PgUUID(), primary_key=True, server_default=sql.text('gen_random_uuid()')),
            Column('verdict', Text(), nullable=False),
            Column('trust_score', Numeric(precision=5, scale=4), nullable=False),
            Column('trust_band', Text(), nullable=False),
            Column('created_at', DateTime(timezone=True), nullable=False, server_default=sql.text('NOW()')),
        )

        async with async_session() as session:
            # Total count
            total_query = select(func.count().label('total'))
            total_result = await session.execute(total_query)
            total = total_result.scalar() or 1  # Avoid division by zero

            # Count by trust band
            query = select(
                decisions.c.trust_band,
                func.count().label('count')
            ).group_by(decisions.c.trust_band)

            result = await session.execute(query)
            rows = result.fetchall()

            return [
                TrustBandDistribution(
                    trust_band=row.trust_band,
                    count=row.count,
                    percentage=round((row.count / total) * 100, 2)
                )
                for row in rows
            ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.get("/cost")
async def cost_analytics() -> dict:
    """Get cost analytics placeholder.

    Note: Full cost tracking requires LLM token logging (Phase 3+).
    Returns basic decision count for now.

    Returns:
        Dict with basic decision counts

    Raises:
        HTTPException: 503 if Phase < 2
    """
    if settings.phase < 2:
        raise HTTPException(status_code=503, detail="Analytics API requires Phase 2 (PostgreSQL)")

    try:
        from sqlalchemy import Table, Column, MetaData, DateTime
        from sqlalchemy.dialects.postgresql import UUID as PgUUID
        from sqlalchemy import sql
        from sqlalchemy import func

        metadata = MetaData()

        decisions = Table(
            'decisions',
            metadata,
            Column('id', PgUUID(), primary_key=True, server_default=sql.text('gen_random_uuid()')),
            Column('created_at', DateTime(timezone=True), nullable=False, server_default=sql.text('NOW()')),
        )

        async with async_session() as session:
            # Total decisions
            total_query = select(func.count().label('total'))
            total_result = await session.execute(total_query)
            total_row = total_result.fetchone()

            # Decisions this month
            month_query = select(func.count().label('monthly')).where(
                decisions.c.created_at >= datetime.utcnow() - timedelta(days=30)
            )
            month_result = await session.execute(month_query)
            month_row = month_result.fetchone()

            return {
                "total_decisions": total_row.total or 0,
                "decisions_this_month": month_row.monthly or 0,
                "note": "Detailed cost tracking requires LLM token logging (Phase 3+)"
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
