import asyncio
import logging
from collections.abc import AsyncGenerator
from typing import Any
from uuid import UUID as PyUUID

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import desc, select

from wcp_backend.config import settings
from wcp_backend.models.schemas import TrustScoredDecision
from wcp_backend.services.db import async_session
from wcp_backend.services.tables import decisions_table

logger = logging.getLogger(__name__)
router = APIRouter()

_decision_subscribers: list[asyncio.Queue[str]] = []


def _reset_subscribers() -> None:
    """Clear all subscribers (for testing)."""
    _decision_subscribers.clear()


class DecisionSummary(BaseModel):
    decision_id: str
    job_id: str
    verdict: str
    trust_score: float
    trust_band: str
    requires_human_review: bool
    violation_count: int
    warning_count: int
    created_at: str


def _row_to_summary(row: Any) -> DecisionSummary:
    return DecisionSummary(
        decision_id=str(row.id),
        job_id=row.job_id,
        verdict=row.verdict,
        trust_score=float(row.trust_score),
        trust_band=row.trust_band,
        requires_human_review=(
            str(row.requires_human_review).lower() in ("true", "t", "1", "yes")
        ),
        violation_count=int(row.violation_count or 0),
        warning_count=int(row.warning_count or 0),
        created_at=row.created_at.isoformat() if row.created_at else "",
    )


def _publish_decision(summary: DecisionSummary) -> None:
    """Broadcast a new decision to all SSE subscribers."""
    payload = summary.model_dump_json()
    dead: list[asyncio.Queue[str]] = []
    for q in _decision_subscribers:
        try:
            q.put_nowait(payload)
        except asyncio.QueueFull:
            dead.append(q)
    for q in dead:
        _decision_subscribers.remove(q)


@router.get("/stream")
async def stream_decisions() -> StreamingResponse:
    """SSE endpoint: push new decisions in real-time."""
    if settings.phase < 2:
        raise HTTPException(
            status_code=503, detail="Decisions API requires Phase 2 (PostgreSQL)"
        )

    queue: asyncio.Queue[str] = asyncio.Queue(maxsize=100)
    _decision_subscribers.append(queue)

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            while True:
                data = await queue.get()
                yield f"data: {data}\n\n"
        except asyncio.CancelledError:
            logger.debug("SSE stream cancelled for decision subscription")
        finally:
            try:
                _decision_subscribers.remove(queue)
            except ValueError:
                pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("", response_model=list[DecisionSummary])
async def list_decisions(
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0),
    verdict: str | None = Query(default=None),
    trust_band: str | None = Query(default=None),
) -> list[DecisionSummary]:
    """List decisions with pagination and optional filtering."""
    if settings.phase < 2:
        raise HTTPException(
            status_code=503, detail="Decisions API requires Phase 2 (PostgreSQL)"
        )

    try:
        async with async_session() as session:
            query = (
                select(decisions_table)
                .order_by(desc(decisions_table.c.created_at))
                .limit(limit)
                .offset(offset)
            )

            if verdict:
                query = query.where(decisions_table.c.verdict == verdict)
            if trust_band:
                query = query.where(decisions_table.c.trust_band == trust_band)

            result = await session.execute(query)
            rows = result.fetchall()
            return [_row_to_summary(row) for row in rows]
    except Exception as e:
        logger.exception("list_decisions failed")
        raise HTTPException(status_code=500, detail="Database error") from e


@router.get("/{decision_id}", response_model=DecisionSummary)
async def get_decision(decision_id: str) -> DecisionSummary:
    """Get a single decision by ID."""
    if settings.phase < 2:
        raise HTTPException(
            status_code=503, detail="Decisions API requires Phase 2 (PostgreSQL)"
        )

    try:
        try:
            uuid_val = PyUUID(decision_id)
        except ValueError:
            raise HTTPException(status_code=404, detail="Decision not found")

        async with async_session() as session:
            query = select(decisions_table).where(decisions_table.c.id == uuid_val)
            result = await session.execute(query)
            row = result.fetchone()

            if not row:
                raise HTTPException(status_code=404, detail="Decision not found")

            return _row_to_summary(row)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("get_decision failed")
        raise HTTPException(status_code=500, detail="Database error") from e


@router.post("", response_model=DecisionSummary, status_code=201)
async def create_decision(decision: TrustScoredDecision) -> DecisionSummary:
    """Persist a new decision to PostgreSQL."""
    if settings.phase < 2:
        raise HTTPException(
            status_code=503, detail="Decisions API requires Phase 2 (PostgreSQL)"
        )

    try:
        async with async_session() as session:
            insert_stmt = (
                decisions_table.insert()
                .values(
                    job_id=decision.job_id,
                    verdict=decision.verdict.value,
                    trust_score=decision.trust_score,
                    trust_band=decision.trust_band.value,
                    requires_human_review=decision.requires_human_review,
                    violation_count=decision.violation_count,
                    warning_count=decision.warning_count,
                    reasoning_summary=decision.reasoning_summary,
                    citations=[c.model_dump(mode="json") for c in decision.citations],
                    cost_usd=decision.cost_usd,
                    latency_ms=decision.latency_ms if decision.latency_ms else None,
                    phoenix_trace_id=decision.phoenix_trace_id,
                )
                .returning(
                    decisions_table.c.id,
                    decisions_table.c.job_id,
                    decisions_table.c.verdict,
                    decisions_table.c.trust_score,
                    decisions_table.c.trust_band,
                    decisions_table.c.requires_human_review,
                    decisions_table.c.violation_count,
                    decisions_table.c.warning_count,
                    decisions_table.c.created_at,
                )
            )

            result = await session.execute(insert_stmt)
            await session.commit()
            row = result.fetchone()
            summary = _row_to_summary(row)
            _publish_decision(summary)
            return summary
    except Exception as e:
        logger.exception("create_decision failed")
        raise HTTPException(status_code=500, detail="Database error") from e
