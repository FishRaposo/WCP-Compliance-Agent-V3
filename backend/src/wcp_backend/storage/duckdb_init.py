"""Storage — DuckDB initialization (V4 scaffold).

Purpose: Initialize DuckDB with views over PostgreSQL and Parquet archives.
Enables transparent analytical queries across live and historical data.

Responsibilities:
- Initialize DuckDB connection
- Register PostgreSQL tables as DuckDB views (postgres_scanner)
- Register Parquet files as DuckDB views
- Register Parquet files as external tables

Key files (V4 spec):
- storage/duckdb_init.py  — Initialize DuckDB views
- storage/parquet_writer.py — Parquet writer
"""

from __future__ import annotations

__all__ = ["init_duckdb_views", "DuckDBInit"]


class DuckDBInit:
    """Initialize and configure DuckDB for cross-contract analytics."""

    def __init__(self, database_path: str = ":memory:") -> None:
        self.database_path = database_path
        self._conn: object | None = None

    def connect(self) -> None:
        """Initialize DuckDB connection."""
        import duckdb

        self._conn = duckdb.connect(self.database_path, read_only=False)

    def register_postgres_view(self, table_name: str) -> None:
        """Register a PostgreSQL table as a DuckDB read-only view.

        Args:
            table_name: Name of the PostgreSQL table/view to register.

        Note:
            Requires postgres_scanner extension. Connection must be open.
        """
        if self._conn is None:
            raise RuntimeError("DuckDB not connected")
        self._conn.execute("LOAD postgres_scanner")
        self._conn.execute(
            f"CREATE VIEW IF NOT EXISTS {table_name} AS "
            f"SELECT * FROM postgres_scan('public', '{table_name}')"
        )

    def register_parquet_view(self, view_name: str, parquet_path: str) -> None:
        """Register a Parquet file as a DuckDB view.

        Args:
            view_name: Name for the DuckDB view.
            parquet_path: Path to Parquet file.
        """
        if self._conn is None:
            raise RuntimeError("DuckDB not connected")
        self._conn.execute(
            f"CREATE VIEW IF NOT EXISTS {view_name} AS "
            f"SELECT * FROM read_parquet('{parquet_path}')"
        )

    def register_parquet_table(self, table_name: str, parquet_path: str) -> None:
        """Register a Parquet file as a DuckDB external table.

        Args:
            table_name: Name for the DuckDB table.
            parquet_path: Path to Parquet file.
        """
        if self._conn is None:
            raise RuntimeError("DuckDB not connected")
        self._conn.execute(
            f"CREATE TABLE IF NOT EXISTS {table_name} AS "
            f"SELECT * FROM read_parquet('{parquet_path}')"
        )

    def close(self) -> None:
        """Close DuckDB connection."""
        if self._conn is not None:
            self._conn.close()
            self._conn = None


def init_duckdb_views(duckdb_path: str = ":memory:") -> DuckDBInit:
    """Initialize DuckDB with all required views (PostgreSQL + Parquet).

    Args:
        duckdb_path: Path for DuckDB database (default :memory:).

    Returns:
        Configured DuckDBInit instance.
    """
    init = DuckDBInit(database_path=duckdb_path)
    init.connect()
    # Register core views
    for table in ["decisions", "contracts", "payroll_records"]:
        try:
            init.register_postgres_view(table)
        except Exception:
            pass  # Skip if table doesn't exist or postgres_scanner unavailable
    init.close()
    return init
