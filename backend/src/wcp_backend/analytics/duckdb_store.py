"""Analytics — DuckDB OLAP store (V4 scaffold).

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

    Reads from PostgreSQL via postgres_scan() and Parquet files via read_parquet().
    This store is intentionally lightweight — real implementation requires:
    - duckdb library (not yet in dependencies)
    - postgres_scanner extension
    - PyArrow for Parquet reading
    """

    def __init__(self, database_path: str = ":memory:") -> None:
        self.database_path = database_path
        self._conn: object | None = None

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

    def execute_query(self, query: str) -> list[dict]:
        """Execute an analytical query and return results as list of dicts.

        Args:
            query: SQL query string.

        Returns:
            List of row dicts.
        """
        if self._conn is None:
            raise RuntimeError("DuckDBStore not connected. Call connect() first.")
        result = self._conn.execute(query)
        columns = [desc[0] for desc in result.description]
        rows = result.fetchall()
        return [dict(zip(columns, row)) for row in rows]

    def register_postgres_view(
        self, view_name: str, schema: str = "public"
    ) -> None:
        """Register a PostgreSQL table as a DuckDB view via postgres_scan.

        Args:
            view_name: Name for the DuckDB view.
            schema: PostgreSQL schema (default public).

        Raises:
            ImportError: If duckdb or postgres_scanner not available.
        """
        if self._conn is None:
            raise RuntimeError("DuckDBStore not connected. Call connect() first.")
        # postgres_scanner must be loaded first: SELECT * FROM postgres_scan();
        self._conn.execute("LOAD postgres_scanner")
        self._conn.execute(
            f"CREATE VIEW IF NOT EXISTS {view_name} AS "
            f"SELECT * FROM postgres_scan('{schema}', '{view_name}')"
        )

    def register_parquet_view(self, view_name: str, path: str) -> None:
        """Register a Parquet file as a DuckDB view.

        Args:
            view_name: Name for the DuckDB view.
            path: Path to Parquet file.
        """
        if self._conn is None:
            raise RuntimeError("DuckDBStore not connected. Call connect() first.")
        self._conn.execute(
            f"CREATE VIEW IF NOT EXISTS {view_name} AS SELECT * FROM read_parquet('{path}')"
        )


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
