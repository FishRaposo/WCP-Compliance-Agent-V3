"""Analytics — DuckDB OLAP store (V4).

Purpose: Fast analytical queries across millions of decisions and payroll records
using DuckDB's in-process OLAP engine. Reads directly from PostgreSQL (operational
data) and Parquet files (historical archive) without data duplication.

Responsibilities:
- DuckDB connection management and view registration
- Analytical SQL queries for dashboard endpoints
- Cross-contract aggregation (decision volume, approval rates, wage trends)
- Time-series analysis (daily/weekly/monthly aggregations)
- LLM cost and performance analytics

Key files (V4 spec):
- analytics/router.py    — FastAPI endpoints (/analytics/*)
- analytics/queries.py   — SQL query functions for each dashboard widget
- analytics/duckdb_store.py — DuckDB connection, PostgreSQL scan, Parquet read
- analytics/schemas.py  — Response schemas for analytics endpoints
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

MODULE_NAME = "analytics"
MODULE_OWNER = "v4"
ROUTE_PREFIX = "/v4/analytics"

__all__ = [
    "MODULE_NAME",
    "MODULE_OWNER",
    "ROUTE_PREFIX",
    "DuckDBStore",
    "get_duckdb_store",
]


class DuckDBStore:
    """DuckDB OLAP store for cross-contract analytics.

    Reads from PostgreSQL via DuckDB's postgres extension and from Parquet
    archives via read_parquet().
    """

    def __init__(self, database_path: str = ":memory:") -> None:
        self.database_path = database_path
        self._conn: Any | None = None

    @property
    def is_connected(self) -> bool:
        return self._conn is not None

    def connect(self) -> None:
        """Initialize DuckDB connection.

        Raises:
            ImportError: If duckdb is not installed.
        """
        import duckdb

        self._conn = duckdb.connect(self.database_path, read_only=False)

    def close(self) -> None:
        """Close DuckDB connection."""
        if self._conn is not None:
            self._conn.close()
            self._conn = None

    def execute_query(self, query: str, parameters: dict[str, Any] | None = None) -> list[dict]:
        """Execute an analytical query and return results as list of dicts.

        Args:
            query: SQL query string.
            parameters: Optional named parameters for the query.

        Returns:
            List of row dicts.
        """
        if self._conn is None:
            raise RuntimeError("DuckDBStore not connected. Call connect() first.")
        result = self._conn.execute(query, parameters)
        columns = [desc[0] for desc in result.description]
        rows = result.fetchall()
        return [dict(zip(columns, row)) for row in rows]

    def register_postgres_view(
        self,
        table_name: str,
        *,
        view_name: str | None = None,
        schema: str = "public",
        connection_uri: str | None = None,
    ) -> None:
        """Register a PostgreSQL table as a DuckDB view.

        Args:
            table_name: PostgreSQL table name.
            view_name: DuckDB view name. Defaults to table_name.
            schema: PostgreSQL schema (default public).
            connection_uri: Optional PostgreSQL URI. If omitted, ATTACH-based
                registration must already exist in the connection.

        Raises:
            ImportError: If duckdb or postgres_scanner not available.
        """
        if self._conn is None:
            raise RuntimeError("DuckDBStore not connected. Call connect() first.")
        safe_view = _quote_identifier(view_name or table_name)
        safe_schema = _quote_literal(schema)
        safe_table = _quote_literal(table_name)
        self._conn.execute("INSTALL postgres")
        self._conn.execute("LOAD postgres")
        if connection_uri:
            safe_uri = _quote_literal(connection_uri)
            self._conn.execute(
                f"CREATE OR REPLACE VIEW {safe_view} AS "
                f"SELECT * FROM postgres_scan({safe_uri}, {safe_schema}, {safe_table})"
            )
            return
        self._conn.execute(
            f"CREATE OR REPLACE VIEW {safe_view} AS "
            f"SELECT * FROM postgres_scan({safe_schema}, {safe_table})"
        )

    def register_parquet_view(self, view_name: str, path: str) -> None:
        """Register a Parquet file as a DuckDB view.

        Args:
            view_name: Name for the DuckDB view.
            path: Path to Parquet file.
        """
        if self._conn is None:
            raise RuntimeError("DuckDBStore not connected. Call connect() first.")
        safe_view = _quote_identifier(view_name)
        safe_path = _quote_literal(str(Path(path)))
        self._conn.execute(
            f"CREATE OR REPLACE VIEW {safe_view} AS SELECT * FROM read_parquet({safe_path})"
        )

    def register_parquet_archive(self, view_name: str, archive_glob: str) -> None:
        """Register a Parquet archive glob as one DuckDB view."""
        self.register_parquet_view(view_name, archive_glob)


_IDENTIFIER_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _quote_identifier(value: str) -> str:
    if not _IDENTIFIER_RE.match(value):
        raise ValueError(f"Unsafe DuckDB identifier: {value!r}")
    return f'"{value}"'


def _quote_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


# Singleton store instance (lazy — connect on first use)
_store: DuckDBStore | None = None


def get_duckdb_store() -> DuckDBStore:
    """Get or create the DuckDB store singleton.

    Returns:
        DuckDBStore instance.
    """
    global _store
    if _store is None:
        _store = DuckDBStore()
    return _store
