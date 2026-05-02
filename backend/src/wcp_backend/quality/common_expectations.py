"""Quality — Common expectation utilities (V4).

Purpose: Reusable Great Expectations expectation definitions shared across
all validation suites.

Provides:
- Reusable column expectation builders
- Shared validation helpers
- GE result parsing utilities
"""

from __future__ import annotations

__all__ = [
    "not_null_expectation",
    "between_expectation",
    "unique_expectation",
    "parse_ge_result",
]


def not_null_expectation(column: str) -> dict:
    """Build a not-null expectation dict.

    Args:
        column: Column name.

    Returns:
        GE expectation dict.
    """
    return {
        "expectation_type": "expect_column_values_to_not_be_null",
        "kwargs": {"column": column},
    }


def between_expectation(column: str, min_value: float, max_value: float) -> dict:
    """Build a between expectation dict.

    Args:
        column: Column name.
        min_value: Minimum allowed value.
        max_value: Maximum allowed value.

    Returns:
        GE expectation dict.
    """
    return {
        "expectation_type": "expect_column_values_to_be_between",
        "kwargs": {"column": column, "min_value": min_value, "max_value": max_value},
    }


def unique_expectation(column: str) -> dict:
    """Build a unique expectation dict.

    Args:
        column: Column name.

    Returns:
        GE expectation dict.
    """
    return {
        "expectation_type": "expect_column_values_to_be_unique",
        "kwargs": {"column": column},
    }


def parse_ge_result(result: dict) -> dict:
    """Parse a Great Expectations validation result.

    Args:
        result: Raw GE result dict.

    Returns:
        Normalized result dict with success, failed_count, errors.
    """
    success = result.get("success", True)
    failed_count = result.get("failed_count", 0)
    errors = result.get("errors", [])
    return {"success": success, "failed_count": failed_count, "errors": errors}
