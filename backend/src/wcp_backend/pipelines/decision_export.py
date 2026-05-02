"""Prefect ETL — Decision export flow (V4).

Purpose: Weekly Parquet archive export of decisions.

Flow steps:
1. Query decisions for the target month from PostgreSQL
2. Write to Parquet using PyArrow
3. Register as DuckDB external table
4. MD5 integrity verification

Responsibilities:
- Monthly scheduled export
- Partition pruning for date-range queries
- Columnar storage for analytical access
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import and_, select

from wcp_backend.pipelines.utils import prefect_flow, prefect_task
from wcp_backend.services.db import async_session
from wcp_backend.services.tables import decisions_table
from wcp_backend.storage.parquet_writer import write_decisions_to_parquet

__all__ = ["decision_export_flow"]


@prefect_task(retries=2, retry_delay_seconds=30)
async def fetch_decisions_for_month(year: int, month: int) -> list[dict[str, Any]]:
    if month < 1 or month > 12:
        raise ValueError("month must be between 1 and 12")
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    end = (
        datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        if month == 12
        else datetime(year, month + 1, 1, tzinfo=timezone.utc)
    )
    async with async_session() as session:
        result = await session.execute(
            select(decisions_table).where(
                and_(decisions_table.c.created_at >= start, decisions_table.c.created_at < end)
            )
        )
        rows = result.fetchall()
    decisions: list[dict[str, Any]] = []
    for row in rows:
        data = dict(row._mapping if hasattr(row, "_mapping") else row)
        if "decisions" in data and hasattr(data["decisions"], "_mapping"):
            data = dict(data["decisions"]._mapping)
        decisions.append({key: _serialize_value(value) for key, value in data.items()})
    return decisions


@prefect_task()
async def write_month_archive(
    decisions: list[dict[str, Any]], year: int, month: int, output_dir: str
) -> dict[str, Any]:
    return write_decisions_to_parquet(decisions, year, month, output_dir)


@prefect_flow(name="decision-export", description="Export monthly decisions to Parquet")
async def decision_export_flow(year: int, month: int, output_dir: str = "archive/decisions") -> dict[str, Any]:
    """Export decisions to Parquet for a given year/month.

    Args:
        year: Year of decisions to export.
        month: Month of decisions to export.
        output_dir: Directory to write Parquet file.

    Returns:
        Dict with export metadata: status, path, records_exported, md5, errors.
    """
    decisions = await fetch_decisions_for_month(year, month)
    result = await write_month_archive(decisions, year, month, output_dir)
    return {
        "status": "success",
        "path": result["path"],
        "records_exported": result["records_written"],
        "md5": result["md5"],
        "errors": [],
        "manifest_updated": bool(result["md5"]),
    }


def _serialize_value(value: Any) -> Any:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value
