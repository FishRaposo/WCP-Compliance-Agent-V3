"""Analytics — SQL query functions for dashboard widgets.

Provides SQLAlchemy-based aggregate query functions that work against
PostgreSQL directly (no DuckDB required). Each function returns structured
dict data suitable for API response serialization.

DuckDB can be layered on top via duckdb_store.py for cross-contract OLAP
performance, but the baseline implementation uses pure SQLAlchemy so it
works without DuckDB dependency.

Functions are designed to be unit-testable with mocked session.execute().
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import and_, case, desc, func, select

from wcp_backend.models.enums import VerdictStatus
from wcp_backend.services.tables import contracts_table, decisions_table

__all__ = [
    "query_overview_metrics",
    "query_decision_volume",
    "query_approval_by_trust_band",
    "query_trust_band_distribution",
    "query_wage_trends",
    "query_llm_cost_analytics",
]


def _safe_float(val: Any, default: float = 0.0) -> float:
    """Convert a value to float safely."""
    if val is None:
        return default
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def _safe_int(val: Any, default: int = 0) -> int:
    """Convert a value to int safely."""
    if val is None:
        return default
    try:
        return int(val)
    except (TypeError, ValueError):
        return default


async def query_overview_metrics(session: Any, days: int = 30) -> dict[str, Any]:
    """Get overview metrics from PostgreSQL.

    Returns:
        Dict with total_decisions, total_contracts, avg_trust_score,
        overall_approval_rate, human_review_queue_depth, decisions_this_month.
    """
    since = datetime.now(timezone.utc) - timedelta(days=days)

    # Total decisions
    total_dec_result = await session.execute(
        select(func.count()).select_from(decisions_table)
    )
    total_decisions = _safe_int(total_dec_result.scalar())

    # Total contracts
    total_con_result = await session.execute(
        select(func.count()).select_from(contracts_table)
    )
    total_contracts = _safe_int(total_con_result.scalar())

    # Avg trust score
    avg_trust_result = await session.execute(
        select(func.avg(decisions_table.c.trust_score))
    )
    avg_trust_score = _safe_float(avg_trust_result.scalar())

    # Approved count
    approved_result = await session.execute(
        select(func.count()).select_from(decisions_table).where(
            decisions_table.c.verdict == VerdictStatus.APPROVED.value
        )
    )
    approved_count = _safe_int(approved_result.scalar())

    # Human review queue
    human_review_result = await session.execute(
        select(func.count()).select_from(decisions_table).where(
            decisions_table.c.requires_human_review.is_(True)
        )
    )
    human_review_queue_depth = _safe_int(human_review_result.scalar())

    # Decisions this period
    month_result = await session.execute(
        select(func.count())
        .select_from(decisions_table)
        .where(decisions_table.c.created_at >= since)
    )
    decisions_this_month = _safe_int(month_result.scalar())

    # Total cost
    cost_result = await session.execute(
        select(func.sum(decisions_table.c.cost_usd)).where(
            decisions_table.c.cost_usd.is_not(None)
        )
    )
    total_cost_usd = _safe_float(cost_result.scalar())

    # Approval rate
    approval_rate = (
        round((approved_count / total_decisions) * 100, 2) if total_decisions > 0 else 0.0
    )

    return {
        "total_decisions": total_decisions,
        "total_contracts": total_contracts,
        "avg_trust_score": round(avg_trust_score, 4),
        "overall_approval_rate": approval_rate,
        "human_review_queue_depth": human_review_queue_depth,
        "decisions_this_month": decisions_this_month,
        "total_cost_usd": round(total_cost_usd, 4),
        "avg_cost_per_decision": (
            round(total_cost_usd / total_decisions, 6) if total_decisions > 0 else 0.0
        ),
        "note": "SQLAlchemy aggregate queries against PostgreSQL",
    }


async def query_decision_volume(session: Any, days: int = 30) -> list[dict[str, Any]]:
    """Get decision volume time-series grouped by date.

    Args:
        session: AsyncSession
        days: Number of days to look back

    Returns:
        List of {date, count, avg_trust, approval_rate} dicts.
    """
    since = datetime.now(timezone.utc) - timedelta(days=days)

    query = (
        select(
            func.date_trunc("day", decisions_table.c.created_at).label("dt"),
            func.count().label("cnt"),
            func.avg(decisions_table.c.trust_score).label("avg_trust"),
            func.sum(
                case(
                    (decisions_table.c.verdict == VerdictStatus.APPROVED.value, 1),
                    else_=0,
                )
            ).label("approved"),
        )
        .where(decisions_table.c.created_at >= since)
        .group_by(func.date_trunc("day", decisions_table.c.created_at))
        .order_by(desc("dt"))
    )

    result = await session.execute(query)
    rows = result.fetchall()

    volume = []
    for row in rows:
        cnt = _safe_int(row.cnt)
        approved = _safe_int(row.approved)
        avg_tr = _safe_float(row.avg_trust)
        rate = round((approved / cnt * 100) if cnt > 0 else 0.0, 2)
        dt = row.dt
        date_str = dt.isoformat() if hasattr(dt, "isoformat") else str(dt)
        volume.append({
            "date": date_str,
            "count": cnt,
            "avg_trust": round(avg_tr, 4),
            "approval_rate": rate,
        })
    return volume


async def query_approval_by_trust_band(session: Any) -> dict[str, Any]:
    """Get approval rates grouped by trust band.

    Args:
        session: AsyncSession

    Returns:
        Dict with overall stats and per-band breakdown.
    """
    # Overall
    total_result = await session.execute(select(func.count()).select_from(decisions_table))
    total = _safe_int(total_result.scalar())

    approved_result = await session.execute(
        select(func.count()).select_from(decisions_table).where(
            decisions_table.c.verdict == VerdictStatus.APPROVED.value
        )
    )
    approved = _safe_int(approved_result.scalar())

    overall_rate = round((approved / total) * 100, 2) if total > 0 else 0.0

    # Per-band breakdown
    band_query = (
        select(
            decisions_table.c.trust_band,
            func.count().label("cnt"),
            func.sum(
                case(
                    (decisions_table.c.verdict == VerdictStatus.APPROVED.value, 1),
                    else_=0,
                )
            ).label("approved"),
        )
        .group_by(decisions_table.c.trust_band)
    )

    band_result = await session.execute(band_query)
    band_rows = band_result.fetchall()

    by_trust_band = []
    for row in band_rows:
        cnt = _safe_int(row.cnt)
        app = _safe_int(row.approved)
        rate = round((app / cnt) * 100, 2) if cnt > 0 else 0.0
        by_trust_band.append({
            "trust_band": row.trust_band or "unknown",
            "total": cnt,
            "approved": app,
            "rate": rate,
        })

    return {
        "overall": {"total": total, "approved": approved, "rate": overall_rate},
        "by_trust_band": by_trust_band,
    }


async def query_trust_band_distribution(session: Any) -> list[dict[str, Any]]:
    """Get distribution of decisions by trust band.

    Args:
        session: AsyncSession

    Returns:
        List of {trust_band, count, percentage} dicts.
    """
    total_result = await session.execute(select(func.count()).select_from(decisions_table))
    total = max(_safe_int(total_result.scalar()), 1)

    query = (
        select(
            decisions_table.c.trust_band,
            func.count().label("cnt"),
        )
        .group_by(decisions_table.c.trust_band)
    )

    result = await session.execute(query)
    rows = result.fetchall()

    distribution = []
    for row in rows:
        cnt = _safe_int(row.cnt)
        distribution.append({
            "trust_band": row.trust_band or "unknown",
            "count": cnt,
            "percentage": round((cnt / total) * 100, 2),
        })
    return distribution


async def query_wage_trends(session: Any, days: int = 90) -> list[dict[str, Any]]:
    """Get wage trend analytics: violation counts over time, by locality and trade.

    Args:
        session: AsyncSession
        days: Number of days to look back

    Returns:
        List of {date, violations, total_checked, violation_rate} dicts.
    """
    since = datetime.now(timezone.utc) - timedelta(days=days)

    query = (
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
        .where(decisions_table.c.created_at >= since)
        .group_by(func.date_trunc("day", decisions_table.c.created_at))
        .order_by(desc("dt"))
    )

    result = await session.execute(query)
    rows = result.fetchall()

    trends = []
    for row in rows:
        total = _safe_int(row.total_checked)
        violations = _safe_int(row.violations)
        rate = round((violations / total) * 100, 2) if total > 0 else 0.0
        dt = row.dt
        date_str = dt.isoformat() if hasattr(dt, "isoformat") else str(dt)
        trends.append({
            "date": date_str,
            "violations": violations,
            "total_checked": total,
            "violation_rate": rate,
        })
    return trends


async def query_llm_cost_analytics(session: Any, days: int = 30) -> dict[str, Any]:
    """Get LLM cost and performance analytics.

    Args:
        session: AsyncSession
        days: Number of days to look back

    Returns:
        Dict with cost metrics (cost_per_decision, latency).
        Returns empty arrays when cost_usd/latency_ms columns are null.
    """
    since = datetime.now(timezone.utc) - timedelta(days=days)

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
        cost_per_decision.append({
            "date": date_str,
            "cost_usd": round(_safe_float(row.avg_cost), 6),
            "decisions": _safe_int(row.cnt),
            "total_cost": round(_safe_float(row.total_cost), 4),
        })

    # Latency statistics
    latency_query = (
        select(
            func.date_trunc("day", decisions_table.c.created_at).label("dt"),
            func.avg(decisions_table.c.latency_ms).label("avg_latency"),
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

    latency = []
    for row in latency_rows:
        dt = row.dt
        date_str = dt.isoformat() if hasattr(dt, "isoformat") else str(dt)
        latency.append({
            "date": date_str,
            "avg_latency_ms": int(_safe_float(row.avg_latency)),
        })

    return {
        "cost_per_decision": cost_per_decision,
        "latency": latency,
        "note": "Requires decisions.cost_usd and decisions.latency_ms columns",
    }
