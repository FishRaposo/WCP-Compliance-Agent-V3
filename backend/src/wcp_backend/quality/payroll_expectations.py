"""Quality — Payroll record validation suite (V4 scaffold).

Purpose: Great Expectations validation suite for payroll records.

Expectations:
- Required fields present (employee_name, trade_code, week_ending, total_hours, hourly_rate)
- total_hours <= 168 (max weekly hours)
- hourly_rate >= 0
- week_ending is a valid date and ideally on a Friday
- No duplicate (employee_name, week_ending) within same contract
- gross_pay matches hourly_rate * total_hours within tolerance
"""

from __future__ import annotations

from typing import Any

from wcp_backend.quality import (
    ValidationResult,
    not_null_expectation,
    between_expectation,
    validate_payroll_records as validate_payroll_records_core,
)

__all__ = ["payroll_expectation_suite", "validate_payroll_records", "ValidationResult"]


def payroll_expectation_suite() -> dict[str, Any]:
    """Return the payroll record GE expectation suite definition.

    Returns:
        Dict representing the GE expectation suite.
    """
    return {
        "expectations": [
            not_null_expectation("employee_name"),
            not_null_expectation("trade_code"),
            not_null_expectation("week_ending"),
            not_null_expectation("total_hours"),
            not_null_expectation("hourly_rate"),
            not_null_expectation("gross_pay"),
            between_expectation("total_hours", 0, 168),
            between_expectation("hourly_rate", 0, 500),
        ]
    }


def validate_payroll_records(records: list[dict[str, Any]]) -> ValidationResult:
    """Validate a batch of payroll records.

    Delegates to the core validation in quality/__init__.py.

    Args:
        records: List of payroll record dicts.

    Returns:
        ValidationResult with pass/fail and error details.
    """
    return validate_payroll_records_core(records)