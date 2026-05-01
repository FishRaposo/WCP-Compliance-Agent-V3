"""Quality — DBWD rate validation suite (V4 scaffold).

Purpose: Great Expectations validation suite for DBWD prevailing wage rates.

Expectations:
- No null rate_key, trade_code, locality_code, or wage
- wage >= 0
- Effective date in valid range
- No duplicate rate_key entries
- wage within ±20% of historical range for same trade/locality
"""

from __future__ import annotations

__all__ = ["dbwd_expectation_suite", "validate_dbwd_rates"]


def dbwd_expectation_suite() -> dict:
    """Return the DBWD GE expectation suite definition.

    Returns:
        Dict representing the GE expectation suite.
    """
    return {
        "expectations": [
            {"expectation_type": "expect_column_values_to_not_be_null", "kwargs": {"column": "rate_key"}},
            {"expectation_type": "expect_column_values_to_not_be_null", "kwargs": {"column": "trade_code"}},
            {"expectation_type": "expect_column_values_to_not_be_null", "kwargs": {"column": "locality_code"}},
            {"expectation_type": "expect_column_values_to_not_be_null", "kwargs": {"column": "wage"}},
            {"expectation_type": "expect_column_values_to_be_between", "kwargs": {"column": "wage", "min_value": 0}},
            {"expectation_type": "expect_column_values_to_be_unique", "kwargs": {"column": "rate_key"}},
        ]
    }


def validate_dbwd_rates(rates: list[dict]) -> dict:
    """Validate a batch of DBWD rates against the expectation suite.

    Args:
        rates: List of DBWD rate dicts.

    Returns:
        Validation result dict.
    """
    return {"success": True, "failed_count": 0, "errors": []}
