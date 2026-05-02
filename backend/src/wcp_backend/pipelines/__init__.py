"""Prefect ETL pipelines (V4).

Purpose: Scheduled and on-demand ETL pipelines using Prefect.
Orchestrates data refresh, bulk processing, and data quality validation workflows.

Responsibilities:
- dbwd_refresh flow: Scheduled SAM.gov rate refresh with GE validation
- decision_export flow: Weekly Parquet archive export
- bulk_ingest flow: Orchestrates large-scale contract/payroll ingestion
- Flow monitoring, retry logic, and failure alerting

Key files (V4 spec):
- pipelines/dbwd_refresh.py  — Scheduled DBWD rate refresh flow
- pipelines/decision_export.py — Parquet export job
- pipelines/bulk_ingest.py   — Bulk ingestion orchestration
- pipelines/utils.py         — Prefect task helpers and shared utilities
"""

from __future__ import annotations

from wcp_backend.pipelines.bulk_ingest import bulk_ingest_flow
from wcp_backend.pipelines.dbwd_refresh import dbwd_refresh_flow
from wcp_backend.pipelines.decision_export import decision_export_flow

MODULE_NAME = "pipelines"
MODULE_OWNER = "v4"

__all__ = [
    "MODULE_NAME",
    "MODULE_OWNER",
    "dbwd_refresh_flow",
    "decision_export_flow",
    "bulk_ingest_flow",
]
