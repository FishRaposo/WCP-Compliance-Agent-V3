"""Quality — Great Expectations validation for V4 data pipelines.

Purpose: Data quality validation as code. Every ingestion pipeline runs through
GE-inspired suites before data reaches the database. Failed batches are 
quarantined for human review.

This module provides practical validation utilities that work without requiring
the great_expectations library to be installed (soft dependency). When GE is
available, its output format is used; when not, custom ValidationResult is
returned.

Responsibilities:
- DBWD rate validation: no nulls, rates within ±20% of historical range, valid trade codes
- Contract data validation: required fields, date range consistency, contract_number uniqueness
- Payroll record validation: wage ranges, hours limits, trade code validity, week_ending validity
- Validation reporting and quarantine management

Key files (V4 spec):
- quality/dbwd_expectations.py     — DBWD validation suite
- quality/contract_expectations.py — Contract validation suite
- quality/payroll_expectations.py  — Payroll validation suite
- quality/common_expectations.py    — Reusable expectation definitions
"""

from __future__ import annotations

from wcp_backend.quality._core import (
    MODULE_NAME,
    MODULE_OWNER,
    ValidationResult,
    not_null_expectation,
    between_expectation,
    unique_expectation,
    parse_validation_result,
    is_valid_trade_code,
    is_valid_locality_code,
    is_friday,
    validate_dbwd_rates,
    validate_contracts,
    validate_payroll_records,
)

__all__ = [
    "MODULE_NAME",
    "MODULE_OWNER",
    "ValidationResult",
    "validate_dbwd_rates",
    "validate_contracts",
    "validate_payroll_records",
    "not_null_expectation",
    "between_expectation",
    "unique_expectation",
    "parse_validation_result",
    "is_valid_trade_code",
    "is_valid_locality_code",
    "is_friday",
    "GERuntime",
]

from wcp_backend.quality.ge_runtime import GERuntime  # noqa: E402
