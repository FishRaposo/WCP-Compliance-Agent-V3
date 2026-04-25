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


class DecisionSummary(BaseModel):
    decision_id: str
    job_id: str
    verdict: str
    trust_score: float
    created_at: str


class DecisionCreate(BaseModel):
    job_id: str
    verdict: str
    trust_score: float
    deterministic_score: float
    classification_score: float
    llm_confidence: float
    agreement: float
    trust_band: str
    violations: list[dict] | None = None
    dbwd_rates: list[dict] | None = None


@router.get("", response_model=list[DecisionSummary])
async def list_decisions(
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0),
    verdict: str | None = Query(default=None),
    trust_band: str | None = Query(default=None),
) -> list[DecisionSummary]:
    """List decisions with pagination and optional filtering.

    Args:
        limit: Max results (default 50, max 200)
        offset: Pagination offset
        verdict: Optional filter by verdict
        trust_band: Optional filter by trust band

    Returns:
        List of DecisionSummary

    Raises:
        HTTPException: 503 if Phase < 2
    """
    if settings.phase < 2:
        raise HTTPException(status_code=503, detail="Decisions API requires Phase 2 (PostgreSQL)")

    try:
        from sqlalchemy import Table, Column, MetaData, Text, DateTime, Numeric
        from sqlalchemy.dialects.postgresql import UUID as PgUUID
        from sqlalchemy import sql

        metadata = MetaData()

        decisions = Table(
            'decisions',
            metadata,
            Column('id', PgUUID(), primary_key=True, server_default=sql.text('gen_random_uuid()')),
            Column('job_id', Text(), nullable=False, unique=True),
            Column('verdict', Text(), nullable=False),
            Column('trust_score', Numeric(precision=5, scale=4), nullable=False),
            Column('deterministic_score', Numeric(precision=5, scale=4), nullable=False),
            Column('classification_score', Numeric(precision=5, scale=4), nullable=False),
            Column('llm_confidence', Numeric(precision=5, scale=4), nullable=False),
            Column('agreement', Numeric(precision=5, scale=4), nullable=False),
            Column('trust_band', Text(), nullable=False),
            Column('violations', Text()),
            Column('dbwd_rates', Text()),
            Column('created_at', DateTime(timezone=True), nullable=False, server_default=sql.text('NOW()')),
        )

        async with async_session() as session:
            query = select(decisions).order_by(desc(decisions.c.created_at)).limit(limit).offset(offset)

            if verdict:
                query = query.where(decisions.c.verdict == verdict)
            if trust_band:
                query = query.where(decisions.c.trust_band == trust_band)

            result = await session.execute(query)
            rows = result.fetchall()

            return [
                DecisionSummary(
                    decision_id=str(row.id),
                    job_id=row.job_id,
                    verdict=row.verdict,
                    trust_score=float(row.trust_score),
                    created_at=row.created_at.isoformat() if row.created_at else ""
                )
                for row in rows
            ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.get("/{decision_id}", response_model=DecisionSummary)
async def get_decision(decision_id: str) -> DecisionSummary:
    """Get a single decision by ID.

    Args:
        decision_id: UUID of the decision

    Returns:
        DecisionSummary

    Raises:
        HTTPException: 404 if not found, 503 if Phase < 2
    """
    if settings.phase < 2:
        raise HTTPException(status_code=503, detail="Decisions API requires Phase 2 (PostgreSQL)")

    try:
        from sqlalchemy import Table, Column, MetaData, Text, DateTime, Numeric
        from sqlalchemy.dialects.postgresql import UUID as PgUUID
        from sqlalchemy import sql

        metadata = MetaData()

        decisions = Table(
            'decisions',
            metadata,
            Column('id', PgUUID(), primary_key=True, server_default=sql.text('gen_random_uuid()')),
            Column('job_id', Text(), nullable=False, unique=True),
            Column('verdict', Text(), nullable=False),
            Column('trust_score', Numeric(precision=5, scale=4), nullable=False),
            Column('deterministic_score', Numeric(precision=5, scale=4), nullable=False),
            Column('classification_score', Numeric(precision=5, scale=4), nullable=False),
            Column('llm_confidence', Numeric(precision=5, scale=4), nullable=False),
            Column('agreement', Numeric(precision=5, scale=4), nullable=False),
            Column('trust_band', Text(), nullable=False),
            Column('violations', Text()),
            Column('dbwd_rates', Text()),
            Column('created_at', DateTime(timezone=True), nullable=False, server_default=sql.text('NOW()')),
        )

        async with async_session() as session:
            from uuid import UUID as PyUUID

            try:
                uuid_val = PyUUID(decision_id)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid decision_id format")

            query = select(decisions).where(decisions.c.id == uuid_val)
            result = await session.execute(query)
            row = result.fetchone()

            if not row:
                raise HTTPException(status_code=404, detail="Decision not found")

            return DecisionSummary(
                decision_id=str(row.id),
                job_id=row.job_id,
                verdict=row.verdict,
                trust_score=float(row.trust_score),
                created_at=row.created_at.isoformat() if row.created_at else ""
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.post("", response_model=DecisionSummary, status_code=201)
async def persist_decision(decision: DecisionCreate) -> DecisionSummary:
    """Persist a new decision to PostgreSQL.

    Args:
        decision: DecisionCreate with all decision fields

    Returns:
        DecisionSummary of created decision

    Raises:
        HTTPException: 503 if Phase < 2
    """
    if settings.phase < 2:
        raise HTTPException(status_code=503, detail="Decisions API requires Phase 2 (PostgreSQL)")

    try:
        import json
        from sqlalchemy import Table, Column, MetaData, Text, DateTime, Numeric
        from sqlalchemy.dialects.postgresql import UUID as PgUUID
        from sqlalchemy import sql

        metadata = MetaData()

        decisions = Table(
            'decisions',
            metadata,
            Column('id', PgUUID(), primary_key=True, server_default=sql.text('gen_random_uuid()')),
            Column('job_id', Text(), nullable=False, unique=True),
            Column('verdict', Text(), nullable=False),
            Column('trust_score', Numeric(precision=5, scale=4), nullable=False),
            Column('deterministic_score', Numeric(precision=5, scale=4), nullable=False),
            Column('classification_score', Numeric(precision=5, scale=4), nullable=False),
            Column('llm_confidence', Numeric(precision=5, scale=4), nullable=False),
            Column('agreement', Numeric(precision=5, scale=4), nullable=False),
            Column('trust_band', Text(), nullable=False),
            Column('violations', Text()),
            Column('dbwd_rates', Text()),
            Column('created_at', DateTime(timezone=True), nullable=False, server_default=sql.text('NOW()')),
        )

        async with async_session() as session:
            insert_stmt = decisions.insert().values(
                job_id=decision.job_id,
                verdict=decision.verdict,
                trust_score=decision.trust_score,
                deterministic_score=decision.deterministic_score,
                classification_score=decision.classification_score,
                llm_confidence=decision.llm_confidence,
                agreement=decision.agreement,
                trust_band=decision.trust_band,
                violations=json.dumps(decision.violations) if decision.violations else None,
                dbwd_rates=json.dumps(decision.dbwd_rates) if decision.dbwd_rates else None,
            ).returning(decisions.c.id, decisions.c.created_at)

            result = await session.execute(insert_stmt)
            await session.commit()

            row = result.fetchone()

            return DecisionSummary(
                decision_id=str(row.id),
                job_id=decision.job_id,
                verdict=decision.verdict,
                trust_score=decision.trust_score,
                created_at=row.created_at.isoformat() if row.created_at else ""
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
