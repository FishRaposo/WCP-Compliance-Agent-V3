"""Prefect ETL — Utility helpers (V4 scaffold).

Purpose: Shared Prefect task helpers and utilities for all ETL flows.

Provides:
- Database connection helpers
- Prefect task decorators
- Retry and timeout configuration
- Shared GE validation runners
"""

from __future__ import annotations

__all__ = [
    "task_retry",
    "task_timeout",
    "run_ge_validation",
    "get_pg_connection",
]


def task_retry(max_attempts: int = 3, delay_seconds: int = 60) -> dict:
    """Return Prefect retry policy configuration.

    Args:
        max_attempts: Maximum retry attempts.
        delay_seconds: Delay between retries.

    Returns:
        Dict compatible with Prefect retry config.
    """
    return {
        "max_attempts": max_attempts,
        "wait": delay_seconds,
    }


def task_timeout(seconds: int = 3600) -> dict:
    """Return Prefect timeout configuration.

    Args:
        seconds: Timeout in seconds.

    Returns:
        Dict compatible with Prefect timeout config.
    """
    return {"timeout_seconds": seconds}


def run_ge_validation(expectation_suite: str, data: list[dict]) -> dict:
    """Run a Great Expectations validation suite on a dataset.

    Args:
        expectation_suite: Name of the GE expectation suite.
        data: List of records to validate.

    Returns:
        Dict with validation results: success, failed_count, results.
    """
    return {
        "success": True,
        "failed_count": 0,
        "results": [],
        "note": "GE placeholder — implement with great_expectations library",
    }


def get_pg_connection() -> object:
    """Get a PostgreSQL connection for ETL tasks.

    Returns:
        DBAPI connection object.
    """
    # Placeholder — real implementation uses asyncpg or psycopg2
    return None
