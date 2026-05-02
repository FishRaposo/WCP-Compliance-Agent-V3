"""Analytics — V4 FastAPI router with DuckDB-friendly aggregate queries.

Mounted at /v4/analytics. Provides stable analytics endpoints for the
analytics dashboard: overview, decision-volume, compliance, wages, llm.

Each endpoint uses SQLAlchemy aggregates against existing PostgreSQL tables
(decisions, contracts, payroll_records) with safe empty-data responses
when no data exists. DuckDB can be layered on top later via duckdb_store.py
for cross-contract OLAP performance, but the baseline implementation uses
pure SQLAlchemy so it works without DuckDB dependency.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import and_, case, desc, func, select

from wcp_backend.analytics.duckdb_queries import (
    duckdb_decision_volume,
    get_analytics_store,
)
from wcp_backend.config import settings
from wcp_backend.services.db import async_session
from wcp_backend.services.tables import contracts_table, decisions_table, payroll_records_table

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v4/analytics", tags=["v4-analytics"])


def _get_duckdb():
    try:
        return get_analytics_store()
    except Exception:
        return None


def _safe_float(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class AnalyticsOverview(BaseModel):
    """Overview metrics for analytics dashboard landing."""

    total_decisions: int = 0
    total_contracts: int = 0
    avg_trust_score: float = 0.0
    overall_approval_rate: float = 0.0
    human_review_queue_depth: int = 0
    decisions_this_month: int = 0
    total_cost_usd: float = 0.0
    avg_cost_per_decision: float = 0.0
    note: str = ""


class DecisionVolumeEntry(BaseModel):
    date: str
    decisions: int
    avg_trust: float = 0.0
    approval_rate: float = 0.0


class DecisionVolumeResponse(BaseModel):
    period: str = "30d"
    granularity: str = "day"
    data: list[DecisionVolumeEntry] = Field(default_factory=list)


class ComplianceByTrade(BaseModel):
    trade: str
    total: int
    approved: int
    flagged: int
    rejected: int
    approval_rate: float


class ComplianceByLocality(BaseModel):
    locality: str
    total: int
    approval_rate: float


class ViolationTypeStat(BaseModel):
    type: str
    count: int
    percentage: float


class ComplianceResponse(BaseModel):
    by_trade: list[ComplianceByTrade] = Field(default_factory=list)
    by_locality: list[ComplianceByLocality] = Field(default_factory=list)
    violation_types: list[ViolationTypeStat] = Field(default_factory=list)
    note: str = ""


class ActualVsRequiredEntry(BaseModel):
    locality: str
    trade: str
    required_wage: float
    actual_avg: float
    compliant_pct: float


class ViolationTrendEntry(BaseModel):
    date: str
    violations: int
    total_checked: int
    violation_rate: float


class FringeComplianceEntry(BaseModel):
    date: str
    compliant_pct: float


class WagesResponse(BaseModel):
    violation_trend: list[ViolationTrendEntry] = Field(default_factory=list)
    actual_vs_required: list[ActualVsRequiredEntry] = Field(default_factory=list)
    fringe_compliance: list[FringeComplianceEntry] = Field(default_factory=list)
    note: str = ""


class TokenUsageEntry(BaseModel):
    date: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class ModelDistributionEntry(BaseModel):
    model: str
    count: int = 0
    percentage: float = 0.0
    avg_cost: float = 0.0


class LatencyByModelEntry(BaseModel):
    model: str = "aggregate"
    date: str = ""
    p50_ms: int = 0
    p95_ms: int = 0
    p99_ms: int = 0


class LLMResponse(BaseModel):
    cost_per_decision: list[dict[str, Any]] = Field(default_factory=list)
    token_usage: list[TokenUsageEntry] = Field(default_factory=list)
    model_distribution: list[ModelDistributionEntry] = Field(default_factory=list)
    latency_by_model: list[LatencyByModelEntry] = Field(default_factory=list)
    note: str = "Token usage and latency tracking requires pg columns (cost_usd, latency_ms). Returns empty data if columns are null."


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


def _empty_response(note: str) -> dict:
    return {"note": note}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/overview", response_model=AnalyticsOverview)
async def analytics_overview(
    days: int = Query(default=30, ge=1, le=365, alias="period_days")
) -> AnalyticsOverview:
    """Aggregated overview for analytics dashboard landing page.

    Returns totals, averages, and rates from decisions + contracts tables.
    Safe empty-data response when no records exist.
    """
    if getattr(settings, "skip_db_startup", False):
        return AnalyticsOverview(
            total_decisions=0,
            total_contracts=0,
            avg_trust_score=0.0,
            overall_approval_rate=0.0,
            human_review_queue_depth=0,
            decisions_this_month=0,
            total_cost_usd=0.0,
            avg_cost_per_decision=0.0,
            note="Mocked overview (SKIP_DB_STARTUP=True)",
        )

    try:
        async with async_session() as session:
            # Total decisions
            total_dec_result = await session.execute(
                select(func.count()).select_from(decisions_table)
            )
            total_decisions = total_dec_result.scalar() or 0

            # Total contracts
            total_con_result = await session.execute(
                select(func.count()).select_from(contracts_table)
            )
            total_contracts = total_con_result.scalar() or 0

            # Avg trust score
            avg_trust_result = await session.execute(
                select(func.avg(decisions_table.c.trust_score))
            )
            avg_trust_score = float(avg_trust_result.scalar() or 0.0)

            # Approved count
            approved_result = await session.execute(
                select(func.count()).select_from(decisions_table).where(
                    decisions_table.c.verdict == "approved"
                )
            )
            approved_count = approved_result.scalar() or 0

            # Human review queue
            human_review_result = await session.execute(
                select(func.count()).select_from(decisions_table).where(
                    decisions_table.c.requires_human_review.is_(True)
                )
            )
            human_review_queue_depth = human_review_result.scalar() or 0

            # Decisions this period
            since = datetime.now(timezone.utc) - timedelta(days=days)
            month_result = await session.execute(
                select(func.count())
                .select_from(decisions_table)
                .where(decisions_table.c.created_at >= since)
            )
            decisions_this_month = month_result.scalar() or 0

            # Total cost (requires cost_usd column to be populated)
            cost_result = await session.execute(
                select(func.sum(decisions_table.c.cost_usd)).where(
                    decisions_table.c.cost_usd.is_not(None)
                )
            )
            total_cost_usd = float(cost_result.scalar() or 0.0)

            # Avg cost per decision
            avg_cost_per_decision = (
                round(total_cost_usd / total_decisions, 6) if total_decisions > 0 else 0.0
            )

            # Approval rate
            overall_approval_rate = (
                round(approved_count / total_decisions * 100, 2) if total_decisions > 0 else 0.0
            )

            return AnalyticsOverview(
                total_decisions=total_decisions,
                total_contracts=total_contracts,
                avg_trust_score=round(avg_trust_score, 4),
                overall_approval_rate=overall_approval_rate,
                human_review_queue_depth=human_review_queue_depth,
                decisions_this_month=decisions_this_month,
                total_cost_usd=round(total_cost_usd, 4),
                avg_cost_per_decision=avg_cost_per_decision,
                note="Derived from PostgreSQL decisions + contracts tables",
            )
    except Exception:
        logger.exception("analytics_overview failed")
        raise HTTPException(status_code=500, detail="Database error")


@router.get("/decision-volume", response_model=DecisionVolumeResponse)
async def decision_volume(
    period: str = Query(default="30d", pattern="^(7d|30d|90d|365d)$"),
    contract_id: str | None = None,
    granularity: str = Query(default="day", pattern="^(hour|day|week|month)$"),
) -> DecisionVolumeResponse:
    """Decision volume time-series grouped by date."""
    # Parse period
    days_map = {"7d": 7, "30d": 30, "90d": 90, "365d": 365}
    days = days_map.get(period, 30)

    # DuckDB fast path
    duckdb_store = _get_duckdb()
    dd_result = duckdb_decision_volume(duckdb_store, days, period, granularity)
    if dd_result is not None:
        data = [
            DecisionVolumeEntry(
                date=r["date"],
                decisions=r["decisions"],
                avg_trust=round(_safe_float(r.get("avg_trust")), 4),
                approval_rate=round(
                    r["approved_count"] / r["decisions"] * 100 if r["decisions"] > 0 else 0, 2
                ),
            )
            for r in dd_result
        ]
        return DecisionVolumeResponse(period=period, granularity=granularity, data=data)

    since = datetime.now(timezone.utc) - timedelta(days=days)

    try:
        async with async_session() as session:
            # Build truncated date expression based on granularity
            if granularity == "hour":
                trunc_expr = func.date_trunc("hour", decisions_table.c.created_at)
            elif granularity == "week":
                trunc_expr = func.date_trunc("week", decisions_table.c.created_at)
            elif granularity == "month":
                trunc_expr = func.date_trunc("month", decisions_table.c.created_at)
            else:
                trunc_expr = func.date_trunc("day", decisions_table.c.created_at)

            # Base query
            conditions = [decisions_table.c.created_at >= since]
            if contract_id:
                conditions.append(decisions_table.c.contract_id == contract_id)

            date_query = (
                select(
                    trunc_expr.label("period_start"),
                    func.count().label("decision_count"),
                    func.avg(decisions_table.c.trust_score).label("avg_trust"),
                    func.sum(
                        case(
                            (decisions_table.c.verdict == "approved", 1),
                            else_=0,
                        )
                    ).label("approved_count"),
                )
                .where(and_(*conditions))
                .group_by(trunc_expr)
                .order_by(desc("period_start"))
            )

            result = await session.execute(date_query)
            rows = result.fetchall()

            data = []
            for row in rows:
                count = row.decision_count or 0
                approved = row.approved_count or 0
                avg_tr = float(row.avg_trust or 0.0)
                approval_rate = round((approved / count * 100) if count > 0 else 0.0, 2)
                period_start = row.period_start
                date_str = (
                    period_start.isoformat()
                    if hasattr(period_start, "isoformat")
                    else str(period_start)
                )
                data.append(
                    DecisionVolumeEntry(
                        date=date_str,
                        decisions=count,
                        avg_trust=round(avg_tr, 4),
                        approval_rate=approval_rate,
                    )
                )

            return DecisionVolumeResponse(period=period, granularity=granularity, data=data)
    except Exception:
        logger.exception("decision_volume failed")
        raise HTTPException(status_code=500, detail="Database error")


@router.get("/compliance", response_model=ComplianceResponse)
async def compliance_breakdown(
    period: str = Query(default="30d", pattern="^(7d|30d|90d|365d)$"),
    contract_id: str | None = None,
) -> ComplianceResponse:
    """Compliance breakdown by trade, locality, and violation type."""
    days_map = {"7d": 7, "30d": 30, "90d": 90, "365d": 365}
    days = days_map.get(period, 30)
    since = datetime.now(timezone.utc) - timedelta(days=days)

    try:
        async with async_session() as session:
            conditions = [decisions_table.c.created_at >= since]
            if contract_id:
                conditions.append(decisions_table.c.contract_id == contract_id)

            # By-trade breakdown: we aggregate via contract join for trade info
            # For now, return safe empty data — trade requires contract lookup
            # Note: decisions.trade is not a direct column; we use verdict breakdown
            # as proxy until trade_code is accessible via contract/payroll join
            by_trade: list[ComplianceByTrade] = []

            # By-locality: use contract locality via existing decisions.contract_id
            locality_query = (
                select(
                    contracts_table.c.locality,
                    func.count().label("total"),
                    func.sum(
                        case(
                            (decisions_table.c.verdict == "approved", 1),
                            else_=0,
                        )
                    ).label("approved"),
                )
                .join(
                    decisions_table,
                    decisions_table.c.contract_id == contracts_table.c.id,
                )
                .where(and_(*conditions))
                .group_by(contracts_table.c.locality)
            )

            locality_result = await session.execute(locality_query)
            locality_rows = locality_result.fetchall()

            by_locality = []
            for row in locality_rows:
                total = row.total or 0
                approved = row.approved or 0
                rate = round((approved / total * 100) if total > 0 else 0.0, 2)
                by_locality.append(
                    ComplianceByLocality(
                        locality=row.locality or "unknown",
                        total=total,
                        approval_rate=rate,
                    )
                )

            # Violation types — count by verdict != approved
            # (signature/wage/overtime/fringe require deeper analysis not in decisions table)
            violation_query = (
                select(
                    decisions_table.c.verdict,
                    func.count().label("cnt"),
                )
                .where(and_(*conditions, decisions_table.c.verdict != "approved"))
                .group_by(decisions_table.c.verdict)
            )

            violation_result = await session.execute(violation_query)
            violation_rows = violation_result.fetchall()
            total_violations = sum(row.cnt or 0 for row in violation_rows)

            violation_types = []
            for row in violation_rows:
                pct = (
                    round((row.cnt / total_violations * 100) if total_violations > 0 else 0.0, 1)
                )
                # Map verdict to violation type labels
                verdict_label = row.verdict or "unknown"
                violation_types.append(
                    ViolationTypeStat(
                        type=verdict_label,
                        count=row.cnt or 0,
                        percentage=pct,
                    )
                )

            return ComplianceResponse(
                by_trade=by_trade,
                by_locality=by_locality,
                violation_types=violation_types,
                note="Trade breakdown requires payroll join; locality uses contract.locality",
            )
    except Exception:
        logger.exception("compliance_breakdown failed")
        raise HTTPException(status_code=500, detail="Database error")


@router.get("/wages", response_model=WagesResponse)
async def wage_analytics(
    period: str = Query(default="30d", pattern="^(7d|30d|90d|365d)$"),
    trade: str | None = None,
    contract_id: str | None = None,
) -> WagesResponse:
    """Wage compliance analytics: trends, actual vs required, fringe compliance."""
    days_map = {"7d": 7, "30d": 30, "90d": 90, "365d": 365}
    days = days_map.get(period, 30)
    since = datetime.now(timezone.utc) - timedelta(days=days)

    try:
        async with async_session() as session:
            conditions = [decisions_table.c.created_at >= since]
            if contract_id:
                conditions.append(decisions_table.c.contract_id == contract_id)
            if trade:
                logger.warning("Trade filter not yet supported for wage analytics (requires payroll join)")

            # Violation trend: decisions with violations over time
            trend_query = (
                select(
                    func.date_trunc("day", decisions_table.c.created_at).label("dt"),
                    func.count().label("total_checked"),
                    func.sum(
                        case(
                            (decisions_table.c.violation_count > 0, 1),
                            else_=0,
                        )
                    ).label("violations"),
                )
                .where(and_(*conditions))
                .group_by(func.date_trunc("day", decisions_table.c.created_at))
                .order_by(desc("dt"))
            )

            trend_result = await session.execute(trend_query)
            trend_rows = trend_result.fetchall()

            violation_trend = []
            for row in trend_rows:
                total = row.total_checked or 0
                violations = row.violations or 0
                rate = round((violations / total * 100) if total > 0 else 0.0, 2)
                dt = row.dt
                date_str = dt.isoformat() if hasattr(dt, "isoformat") else str(dt)
                violation_trend.append(
                    ViolationTrendEntry(
                        date=date_str,
                        violations=violations,
                        total_checked=total,
                        violation_rate=rate,
                    )
                )

            # Actual vs required: avg hourly_rate by locality from payroll_records
            # Requires payroll_records table with hourly_rate and locality
            actual_vs_required: list[ActualVsRequiredEntry] = []

            avq = (
                select(
                    payroll_records_table.c.locality_code,
                    payroll_records_table.c.trade_code,
                    func.avg(payroll_records_table.c.hourly_rate).label("avg_rate"),
                    func.count().label("cnt"),
                )
                .where(
                    and_(
                        payroll_records_table.c.hourly_rate.is_not(None),
                        payroll_records_table.c.locality_code.is_not(None),
                    )
                )
                .group_by(
                    payroll_records_table.c.locality_code,
                    payroll_records_table.c.trade_code,
                )
                .limit(50)
            )

            avq_result = await session.execute(avq)
            avq_rows = avq_result.fetchall()

            for row in avq_rows:
                actual_avg = float(row.avg_rate or 0.0)
                actual_vs_required.append(
                    ActualVsRequiredEntry(
                        locality=row.locality_code or "unknown",
                        trade=row.trade_code or "unknown",
                        required_wage=0.0,
                        actual_avg=round(actual_avg, 2),
                        compliant_pct=0.0,
                    )
                )

            # DBWD required wage lookup for actual_vs_required entries
            from sqlalchemy import text as sa_text

            for entry in actual_vs_required:
                try:
                    dbwd_result = await session.execute(
                        sa_text(
                            "SELECT AVG(rate) AS avg_rate FROM dbwd_rates "
                            "WHERE trade ILIKE :trade AND locality ILIKE :locality"
                        ),
                        {"trade": f"%{entry.trade}%", "locality": f"%{entry.locality}%"},
                    )
                    required = _safe_float(dbwd_result.scalar())
                    if required > 0:
                        entry.required_wage = round(required, 2)
                        entry.compliant_pct = (
                            round(min(entry.actual_avg / required * 100, 100), 2)
                            if required > 0
                            else 0.0
                        )
                except Exception:
                    pass

            # Fringe compliance: flag records with missing fringe data
            fringe_query = (
                select(
                    func.date_trunc("day", payroll_records_table.c.created_at).label("dt"),
                    func.count().label("total"),
                    func.sum(
                        case(
                            (
                                and_(
                                    payroll_records_table.c.fringe_rate.is_not(None),
                                    payroll_records_table.c.fringe_rate > 0,
                                ),
                                1,
                            ),
                            else_=0,
                        )
                    ).label("compliant"),
                )
                .where(payroll_records_table.c.created_at.isnot(None))
                .group_by(func.date_trunc("day", payroll_records_table.c.created_at))
                .order_by(desc("dt"))
                .limit(30)
            )

            fringe_result = await session.execute(fringe_query)
            fringe_rows = fringe_result.fetchall()

            fringe_compliance = []
            for row in fringe_rows:
                total = row.total or 0
                compliant = row.compliant or 0
                pct = round((compliant / total * 100) if total > 0 else 0.0, 2)
                dt = row.dt
                date_str = dt.isoformat() if hasattr(dt, "isoformat") else str(dt)
                fringe_compliance.append(FringeComplianceEntry(date=date_str, compliant_pct=pct))

            return WagesResponse(
                violation_trend=violation_trend,
                actual_vs_required=actual_vs_required,
                fringe_compliance=fringe_compliance,
                note="Required wage comparison requires DBWD prevailing wage lookup",
            )
    except Exception:
        logger.exception("wage_analytics failed")
        raise HTTPException(status_code=500, detail="Database error")


@router.get("/llm", response_model=LLMResponse)
async def llm_analytics(
    period: str = Query(default="30d", pattern="^(7d|30d|90d|365d)$"),
) -> LLMResponse:
    """LLM cost and performance analytics.

    Returns cost per decision, token usage, model distribution, and latency
    by model. Requires decisions.cost_usd and decisions.latency_ms to be populated.
    Returns empty data arrays when those columns are null.
    """
    days_map = {"7d": 7, "30d": 30, "90d": 90, "365d": 365}
    days = days_map.get(period, 30)
    since = datetime.now(timezone.utc) - timedelta(days=days)

    try:
        async with async_session() as session:
            # Cost per decision over time
            cost_query = (
                select(
                    func.date_trunc("day", decisions_table.c.created_at).label("dt"),
                    func.avg(decisions_table.c.cost_usd).label("avg_cost"),
                    func.count().label("cnt"),
                    func.sum(decisions_table.c.cost_usd).label("total_cost"),
                )
                .where(
                    and_(
                        decisions_table.c.created_at >= since,
                        decisions_table.c.cost_usd.is_not(None),
                    )
                )
                .group_by(func.date_trunc("day", decisions_table.c.created_at))
                .order_by(desc("dt"))
            )

            cost_result = await session.execute(cost_query)
            cost_rows = cost_result.fetchall()

            cost_per_decision = []
            for row in cost_rows:
                dt = row.dt
                date_str = dt.isoformat() if hasattr(dt, "isoformat") else str(dt)
                cost_per_decision.append(
                    {
                        "date": date_str,
                        "cost_usd": round(float(row.avg_cost or 0.0), 6),
                        "decisions": row.cnt or 0,
                        "total_cost": round(float(row.total_cost or 0.0), 4),
                    }
                )

            # Token usage: currently no token column in decisions table
            # This would need Phoenix trace join or LLM logging extension
            token_usage: list[TokenUsageEntry] = []

            # Model distribution: no model column in decisions table yet
            # Use verdict grouping as proxy distribution
            model_dist_query = (
                select(
                    decisions_table.c.verdict.label("model"),
                    func.count().label("count"),
                )
                .where(decisions_table.c.created_at >= since)
                .group_by(decisions_table.c.verdict)
            )
            model_dist_result = await session.execute(model_dist_query)
            model_dist_rows = model_dist_result.fetchall()
            total_model = sum(r.count or 0 for r in model_dist_rows)
            model_distribution = []
            for r in model_dist_rows:
                model_distribution.append(
                    ModelDistributionEntry(
                        model=r.model or "unknown",
                        count=r.count or 0,
                        percentage=round(
                            (r.count / total_model * 100) if total_model > 0 else 0.0, 1
                        ),
                    )
                )

            # Latency by model: requires latency_ms column
            latency_query = (
                select(
                    func.date_trunc("day", decisions_table.c.created_at).label("dt"),
                    func.avg(decisions_table.c.latency_ms).label("avg_latency"),
                    func.percentile_cont(0.5)
                    .within_group(decisions_table.c.latency_ms)
                    .label("p50"),
                    func.percentile_cont(0.95)
                    .within_group(decisions_table.c.latency_ms)
                    .label("p95"),
                    func.percentile_cont(0.99)
                    .within_group(decisions_table.c.latency_ms)
                    .label("p99"),
                )
                .where(
                    and_(
                        decisions_table.c.created_at >= since,
                        decisions_table.c.latency_ms.is_not(None),
                    )
                )
                .group_by(func.date_trunc("day", decisions_table.c.created_at))
                .order_by(desc("dt"))
            )

            latency_result = await session.execute(latency_query)
            latency_rows = latency_result.fetchall()

            latency_by_model = []
            for row in latency_rows:
                dt = row.dt
                date_str = dt.isoformat() if hasattr(dt, "isoformat") else str(dt)
                latency_by_model.append(
                    {
                        "date": date_str,
                        "p50_ms": int(row.p50 or 0),
                        "p95_ms": int(row.p95 or 0),
                        "p99_ms": int(row.p99 or 0),
                    }
                )

            return LLMResponse(
                cost_per_decision=cost_per_decision,
                token_usage=token_usage,
                model_distribution=model_distribution,
                latency_by_model=latency_by_model,
                note="Token usage and model distribution require LLM logging columns (token_count, model). Latency from decisions.latency_ms.",
            )
    except Exception:
        logger.exception("llm_analytics failed")
        raise HTTPException(status_code=500, detail="Database error")


# ---------------------------------------------------------------------------
# Module metadata (for test_v4_scaffold.py verification)
# ---------------------------------------------------------------------------

MODULE_NAME = "analytics"
MODULE_OWNER = "v4"
ROUTE_PREFIX = "/v4/analytics"
