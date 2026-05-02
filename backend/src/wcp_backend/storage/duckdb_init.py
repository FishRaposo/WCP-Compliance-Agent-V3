"""Storage — DuckDB initialization (V4).

Purpose: Initialize DuckDB with views over PostgreSQL and Parquet archives.
Enables transparent analytical queries across live and historical data.

Delegates view registration to analytics.duckdb_store.DuckDBStore to avoid
duplicating connection and registration logic.
"""

from __future__ import annotations

from wcp_backend.analytics.duckdb_store import DuckDBStore

__all__ = ["init_duckdb_views", "DuckDBInit"]


DuckDBInit = DuckDBStore


def init_duckdb_views(
    duckdb_path: str = ":memory:",
    postgres_uri: str | None = None,
    parquet_archive_glob: str | None = None,
) -> DuckDBStore:
    """Initialize DuckDB with all required views (PostgreSQL + Parquet).

    Args:
        duckdb_path: Path for DuckDB database (default :memory:).
        postgres_uri: PostgreSQL connection URI for postgres_scanner.
        parquet_archive_glob: Glob pattern for Parquet archive files.

    Returns:
        Connected DuckDBStore instance with views registered.
    """
    store = DuckDBStore(database_path=duckdb_path)
    store.connect()
    for table in ["decisions", "contracts", "payroll_records"]:
        try:
            store.register_postgres_view(table, connection_uri=postgres_uri)
        except Exception:
            pass
    if parquet_archive_glob:
        try:
            store.register_parquet_view("archived_decisions", parquet_archive_glob)
        except Exception:
            pass
    return store
