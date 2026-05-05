"""Analytics — DuckDB-native analytical query functions (V4).

Provides fast OLAP queries using DuckDB's columnar engine with PostgreSQL
view registration. Each function returns None on any error, signalling the
caller to fall back to the PostgreSQL aggregate path.
"""

from __future__ import annotations

import logging
from typing import Any

from wcp_backend.analytics.duckdb_store import DuckDBStore
from wcp_backend.config import settings

logger = logging.getLogger(__name__)

_analytics_store: DuckDBStore | None = None


def _ensure_analytics_store() -> DuckDBStore | None:
    """Return a singleton DuckDBStore with PostgreSQL views registered.

    Returns None if DuckDB or postgres_scanner is unavailable.
    """
    global _analytics_store
    if _analytics_store is not None:
        return _analytics_store

    try:
        from wcp_backend.analytics.duckdb_store import DuckDBStore as _Store

        store = _Store()
        store.connect()

        db_url = settings.database_url.replace("+asyncpg", "")
        for table_name in ("decisions", "contracts", "payroll_records"):
            store.register_postgres_view(
                table_name,
                view_name=table_name,
                connection_uri=db_url,
            )

        _analytics_store = store
        return _analytics_store
    except Exception:
        logger.debug("DuckDB analytics store unavailable, falling back to PostgreSQL", exc_info=True)
        return None


def duckdb_decision_volume(
    store: DuckDBStore | None,
    days: int,
    period: str,
    granularity: str,
) -> list[dict[str, Any]] | None:
    """Decision volume time-series using DuckDB."""
    if store is None:
        return None
    allowed_granularities = {"hour", "day", "week", "month"}
    if granularity not in allowed_granularities:
        raise ValueError(f"Invalid granularity: {granularity}")
    if not isinstance(days, int) or days < 0:
        raise ValueError(f"Invalid days: {days}")
    try:
        sql = """
            SELECT
                date_trunc($granularity, created_at)::text AS date,
                COUNT(*) AS decisions,
                COALESCE(AVG(trust_score), 0) AS avg_trust,
                SUM(CASE WHEN verdict = 'approved' THEN 1 ELSE 0 END) AS approved_count
            FROM decisions
            WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL $days days
            GROUP BY 1
            ORDER BY 1 DESC
        """
        return store.execute_query(sql, {"granularity": granularity, "days": days})
    except Exception:
        logger.debug("duckdb_decision_volume failed", exc_info=True)
        return None


def duckdb_compliance_breakdown(
    store: DuckDBStore | None,
    days: int,
) -> dict[str, Any] | None:
    """Compliance breakdown by trade, locality, and verdict using DuckDB."""
    if store is None:
        return None
    if not isinstance(days, int) or days < 0:
        raise ValueError(f"Invalid days: {days}")
    try:
        by_locality_sql = """
            SELECT
                c.locality,
                COUNT(*) AS total,
                SUM(CASE WHEN d.verdict = 'approved' THEN 1 ELSE 0 END) AS approved
            FROM decisions d
            JOIN contracts c ON d.contract_id = c.id
            WHERE d.created_at >= CURRENT_TIMESTAMP - INTERVAL $days days
            GROUP BY c.locality
        """
        by_locality = store.execute_query(by_locality_sql, {"days": days})

        violations_sql = """
            SELECT
                verdict,
                COUNT(*) AS cnt
            FROM decisions
            WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL $days days
              AND verdict != 'approved'
            GROUP BY verdict
        """
        violations = store.execute_query(violations_sql, {"days": days})

        return {
            "by_locality": by_locality,
            "violations": violations,
        }
    except Exception:
        logger.debug("duckdb_compliance_breakdown failed", exc_info=True)
        return None


def duckdb_wage_analytics(
    store: DuckDBStore | None,
    days: int,
) -> dict[str, Any] | None:
    """Wage analytics: violation trends, avg rates by locality/trade using DuckDB."""
    if store is None:
        return None
    if not isinstance(days, int) or days < 0:
        raise ValueError(f"Invalid days: {days}")
    try:
        trend_sql = """
            SELECT
                date_trunc('day', created_at)::text AS date,
                COUNT(*) AS total_checked,
                SUM(CASE WHEN violation_count > 0 THEN 1 ELSE 0 END) AS violations
            FROM decisions
            WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL $days days
            GROUP BY 1
            ORDER BY 1 DESC
        """
        trend = store.execute_query(trend_sql, {"days": days})

        actual_vs_required_sql = """
            SELECT
                locality_code AS locality,
                trade_code AS trade,
                AVG(hourly_rate) AS avg_rate,
                COUNT(*) AS cnt
            FROM payroll_records
            WHERE hourly_rate IS NOT NULL
              AND locality_code IS NOT NULL
            GROUP BY locality_code, trade_code
            LIMIT 50
        """
        actual_vs_required = store.execute_query(actual_vs_required_sql)

        fringe_sql = """
            SELECT
                date_trunc('day', created_at)::text AS date,
                COUNT(*) AS total,
                SUM(CASE WHEN fringe_rate IS NOT NULL AND fringe_rate > 0 THEN 1 ELSE 0 END) AS compliant
            FROM payroll_records
            WHERE created_at IS NOT NULL
            GROUP BY 1
            ORDER BY 1 DESC
            LIMIT 30
        """
        fringe = store.execute_query(fringe_sql)

        return {
            "trend": trend,
            "actual_vs_required": actual_vs_required,
            "fringe": fringe,
        }
    except Exception:
        logger.debug("duckdb_wage_analytics failed", exc_info=True)
        return None


def duckdb_overview(
    store: DuckDBStore | None,
    days: int,
) -> dict[str, Any] | None:
    """Overview metrics using DuckDB."""
    if store is None:
        return None
    if not isinstance(days, int) or days < 0:
        raise ValueError(f"Invalid days: {days}")
    try:
        sql = """
            SELECT
                COUNT(*) AS total_decisions,
                COALESCE(AVG(trust_score), 0) AS avg_trust_score,
                SUM(CASE WHEN verdict = 'approved' THEN 1 ELSE 0 END) AS approved_count,
                SUM(CASE WHEN requires_human_review = TRUE THEN 1 ELSE 0 END) AS human_review_count,
                SUM(CASE WHEN created_at >= CURRENT_TIMESTAMP - INTERVAL $days days THEN 1 ELSE 0 END) AS decisions_this_period,
                COALESCE(SUM(cost_usd), 0) AS total_cost_usd
            FROM decisions
        """
        result = store.execute_query(sql, {"days": days})
        if not result:
            return None
        row = result[0]

        # Get contract count
        contract_sql = "SELECT COUNT(*) AS cnt FROM contracts"
        contract_result = store.execute_query(contract_sql)
        total_contracts = contract_result[0].get("cnt", 0) if contract_result else 0

        total_decisions = row.get("total_decisions", 0)
        approved_count = row.get("approved_count", 0)
        total_cost = row.get("total_cost_usd", 0) or 0

        return {
            "total_decisions": total_decisions,
            "total_contracts": total_contracts,
            "avg_trust_score": round(row.get("avg_trust_score", 0) or 0, 4),
            "overall_approval_rate": round((approved_count / total_decisions * 100) if total_decisions > 0 else 0.0, 2),
            "human_review_queue_depth": row.get("human_review_count", 0),
            "decisions_this_month": row.get("decisions_this_period", 0),
            "total_cost_usd": round(total_cost, 4),
            "avg_cost_per_decision": round(total_cost / total_decisions, 6) if total_decisions > 0 else 0.0,
        }
    except Exception:
        logger.debug("duckdb_overview failed", exc_info=True)
        return None


def _register_parquet_archive(store: DuckDBStore) -> None:
    """Register Parquet archive views if archive exists."""
    try:
        import os
        archive_path = os.environ.get("PARQUET_ARCHIVE_PATH", "./archive")
        if os.path.exists(archive_path):
            # Register archive decisions view
            archive_glob = f"{archive_path}/decisions_*.parquet"
            store.register_parquet_archive("decisions_archive", archive_glob)
            
            # Create unified view
            store._conn.execute("""
                CREATE OR REPLACE VIEW all_decisions AS
                SELECT * FROM decisions
                UNION ALL
                SELECT * FROM decisions_archive
            """)
    except Exception:
        logger.debug("Parquet archive registration failed (may not exist yet)", exc_info=True)


def _ensure_analytics_store_with_archive() -> DuckDBStore | None:
    """Get analytics store with Parquet archive registered."""
    store = _ensure_analytics_store()
    if store is not None:
        _register_parquet_archive(store)
    return store


def duckdb_llm_analytics(
    store: DuckDBStore | None,
    days: int,
) -> dict[str, Any] | None:
    """LLM cost and performance analytics using DuckDB."""
    if store is None:
        return None
    if not isinstance(days, int) or days < 0:
        raise ValueError(f"Invalid days: {days}")
    try:
        cost_sql = """
            SELECT
                date_trunc('day', created_at)::text AS date,
                AVG(cost_usd) AS avg_cost,
                COUNT(*) AS decisions,
                SUM(cost_usd) AS total_cost
            FROM decisions
            WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL $days days
              AND cost_usd IS NOT NULL
            GROUP BY 1
            ORDER BY 1 DESC
        """
        cost = store.execute_query(cost_sql, {"days": days})

        model_sql = """
            SELECT
                verdict AS model,
                COUNT(*) AS cnt
            FROM decisions
            WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL $days days
            GROUP BY verdict
        """
        model_dist = store.execute_query(model_sql, {"days": days})

        latency_sql = """
            SELECT
                date_trunc('day', created_at)::text AS date,
                AVG(latency_ms) AS avg_latency
            FROM decisions
            WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL $days days
              AND latency_ms IS NOT NULL
            GROUP BY 1
            ORDER BY 1 DESC
        """
        latency = store.execute_query(latency_sql)

        return {
            "cost_per_decision": cost,
            "model_distribution": model_dist,
            "latency": latency,
        }
    except Exception:
        logger.debug("duckdb_llm_analytics failed", exc_info=True)
        return None
