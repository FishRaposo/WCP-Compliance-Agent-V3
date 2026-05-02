"""Quality — Contract validation suite (V4).

Purpose: Great Expectations validation suite for contract records.

Expectations:
- Required fields present (contract_number, contractor_name, locality, start_date)
- start_date <= end_date (if both present)
- contract_number uniqueness
- status in [active, completed, terminated, suspended]
"""

from __future__ import annotations

from typing import Any

from wcp_backend.quality._core import (
    ValidationResult,
    not_null_expectation,
    unique_expectation,
    validate_contracts as validate_contracts_core,
)

__all__ = ["contract_expectation_suite", "validate_contracts", "ValidationResult"]


def contract_expectation_suite() -> dict[str, Any]:
    """Return the contract GE expectation suite definition.

    Returns:
        Dict representing the GE expectation suite.
    """
    return {
        "expectations": [
            not_null_expectation("contract_number"),
            not_null_expectation("project_name"),
            not_null_expectation("contractor_name"),
            not_null_expectation("locality"),
            not_null_expectation("start_date"),
            unique_expectation("contract_number"),
        ]
    }


def validate_contracts(contracts: list[dict[str, Any]]) -> ValidationResult:
    """Validate a batch of contract records.

    Delegates to the core validation in quality/__init__.py.

    Args:
        contracts: List of contract dicts.

    Returns:
        ValidationResult with pass/fail and error details.
    """
    return validate_contracts_core(contracts)
