"""Analytics — V4 module for DuckDB OLAP queries and dashboard endpoints.

Provides:
- router.py: FastAPI endpoints at /v4/analytics/*
- queries.py: SQL query functions for each dashboard widget
- duckdb_store.py: DuckDB connection, PostgreSQL scan, Parquet read
"""

from __future__ import annotations

MODULE_NAME = "analytics"
MODULE_OWNER = "v4"
ROUTE_PREFIX = "/v4/analytics"

__all__ = [
    "MODULE_NAME",
    "MODULE_OWNER",
    "ROUTE_PREFIX",
    "router",
]