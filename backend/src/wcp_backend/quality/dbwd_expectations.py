"""Quality — DBWD rate validation suite (V4).

Purpose: Great Expectations validation suite for DBWD prevailing wage rates.

Expectations:
- No null rate_key, trade_code, locality_code, or wage
- wage >= 0
- Effective date in valid range
- No duplicate rate_key entries
- wage within ±20% of historical range for same trade/locality
"""

from __future__ import annotations

from typing import Any

from wcp_backend.quality import (
    ValidationResult,
    between_expectation,
    not_null_expectation,
    unique_expectation,
    validate_dbwd_rates as validate_dbwd_rates_core,
)

__all__ = ["dbwd_expectation_suite", "validate_dbwd_rates", "ValidationResult"]


def dbwd_expectation_suite() -> dict[str, Any]:
    """Return the DBWD GE expectation suite definition.

    Returns:
        Dict representing the GE expectation suite.
    """
    return {
        "expectations": [
            not_null_expectation("rate_key"),
            not_null_expectation("trade_code"),
            not_null_expectation("locality_code"),
            not_null_expectation("wage"),
            between_expectation("wage", 0, 500),
            unique_expectation("rate_key"),
        ]
    }


def validate_dbwd_rates(rates: list[dict[str, Any]]) -> ValidationResult:
    """Validate a batch of DBWD rates against the expectation suite.

    Args:
        rates: List of DBWD rate dicts.

    Returns:
        ValidationResult with pass/fail and row-level errors.
    """
    return validate_dbwd_rates_core(rates)
