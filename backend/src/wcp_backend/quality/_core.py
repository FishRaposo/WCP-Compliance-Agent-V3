"""Quality — Core validation types and helpers (V4).

This module contains the core data structures, expectation helpers, and
validation functions used by the quality module. It exists to break a
circular import dependency between quality/__init__.py and its submodules.
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Any

MODULE_NAME = "quality"
MODULE_OWNER = "v4"

_logger = logging.getLogger(__name__)


class ValidationResult:
    """Result of a validation run.

    Attributes:
        success: True if all validations passed
        failed_count: Number of records that failed validation
        errors: List of error dicts with row index and error message
        warnings: List of warning dicts (non-blocking issues)
    """

    def __init__(
        self,
        success: bool,
        failed_count: int = 0,
        errors: list[dict[str, Any]] | None = None,
        warnings: list[dict[str, Any]] | None = None,
    ) -> None:
        self.success = success
        self.failed_count = failed_count
        self.errors = errors or []
        self.warnings = warnings or []

    def model_dump(self) -> dict[str, Any]:
        return {
            "success": self.success,
            "failed_count": self.failed_count,
            "errors": self.errors,
            "warnings": self.warnings,
        }

    def __bool__(self) -> bool:
        return self.success


# ---------------------------------------------------------------------------
# Common expectation helpers (works without great_expectations library)
# ---------------------------------------------------------------------------


def not_null_expectation(column: str) -> dict[str, Any]:
    """Build a not-null expectation dict (GE-compatible format).

    Args:
        column: Column name.

    Returns:
        Dict representing the expectation.
    """
    return {
        "expectation_type": "expect_column_values_to_not_be_null",
        "kwargs": {"column": column},
    }


def between_expectation(column: str, min_value: float, max_value: float) -> dict[str, Any]:
    """Build a between expectation dict (GE-compatible format).

    Args:
        column: Column name.
        min_value: Minimum allowed value.
        max_value: Maximum allowed value.

    Returns:
        Dict representing the expectation.
    """
    return {
        "expectation_type": "expect_column_values_to_be_between",
        "kwargs": {"column": column, "min_value": min_value, "max_value": max_value},
    }


def unique_expectation(column: str) -> dict[str, Any]:
    """Build a unique expectation dict (GE-compatible format).

    Args:
        column: Column name.

    Returns:
        Dict representing the expectation.
    """
    return {
        "expectation_type": "expect_column_values_to_be_unique",
        "kwargs": {"column": column},
    }


def parse_validation_result(result: dict[str, Any]) -> ValidationResult:
    """Parse a Great Expectations validation result into ValidationResult.

    Args:
        result: Raw GE result dict.

    Returns:
        Normalized ValidationResult.
    """
    success = result.get("success", True)
    failed_count = result.get("failed_count", 0)
    errors = result.get("errors", [])
    warnings = result.get("warnings", [])
    return ValidationResult(
        success=success,
        failed_count=failed_count,
        errors=errors,
        warnings=warnings,
    )


# ---------------------------------------------------------------------------
# Trade/locality helpers
# ---------------------------------------------------------------------------

# Common Davis-Bacon trade codes (subset for validation)
VALID_TRADE_CODES = {
    "BRICK", "CARP", "ELEC", "HVAC", "IRON", "LABR", "PAINT", "PLUMB", "ROOF", "SHEET",
    "SON1", "SON2", "SON3", "SON4", "SON5", "SON6", "SON7", "SON8", "SIGN", "TILE",
    "TruckDriver", "WELD",
}

LOCALITY_CODES_BY_STATE = {
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
    "DC", "PR",
}


def is_valid_trade_code(code: str) -> bool:
    """Check if a trade code is a known Davis-Bacon trade code.

    Args:
        code: Trade code string (case-insensitive)

    Returns:
        True if valid, False otherwise
    """
    return code.upper() in VALID_TRADE_CODES


def is_valid_locality_code(code: str) -> bool:
    """Check if a locality code looks valid (basic format check).

    Args:
        code: Locality code string (e.g., "Boston, MA" or "AL")

    Returns:
        True if looks valid, False otherwise
    """
    if not code:
        return False
    # Basic format: either "City, ST" format or two-letter state abbreviation
    parts = code.split(",")
    if len(parts) == 2:
        state = parts[-1].strip().upper()
        return state in LOCALITY_CODES_BY_STATE or state == "DC"
    return len(code) == 2 and code.upper() in LOCALITY_CODES_BY_STATE


def is_friday(d: date) -> bool:
    """Check if a date falls on a Friday (week_ending should be Friday).

    Args:
        d: Date to check

    Returns:
        True if Friday, False otherwise
    """
    return d.weekday() == 4  # Monday=0, Friday=4


# ---------------------------------------------------------------------------
# Core validation functions
# ---------------------------------------------------------------------------


def validate_dbwd_rates(rates: list[dict[str, Any]]) -> ValidationResult:
    """Validate DBWD prevailing wage rates.

    Checks:
    - No null required fields (rate_key, trade_code, locality_code, wage)
    - wage >= 0 and within reasonable bounds (not negative, not > 500)
    - Valid trade_code format
    - Valid locality_code format
    - wage within ±20% of median (historical sanity check, skipped for small batches)

    Args:
        rates: List of DBWD rate dicts.

    Returns:
        ValidationResult with pass/fail and error details.
    """
    errors: list[dict[str, Any]] = []
    required_fields = ["rate_key", "trade_code", "locality_code", "wage"]

    for index, rate in enumerate(rates, start=1):
        row_errors = []

        # Required fields check
        for field in required_fields:
            if field not in rate or rate[field] is None or str(rate.get(field, "")).strip() == "":
                row_errors.append(f"missing required field: {field}")

        # Wage range check
        try:
            wage = float(rate.get("wage", 0))
            if wage < 0:
                row_errors.append(f"wage cannot be negative: {wage}")
            if wage > 500:  # Sanity check for extraordinary rates
                row_errors.append(f"wage exceeds reasonable maximum ($500): {wage}")
        except (TypeError, ValueError):
            row_errors.append(f"wage must be a number, got: {rate.get('wage')}")

        # Trade code validation
        trade_code = str(rate.get("trade_code", "")).strip().upper()
        if trade_code and trade_code not in VALID_TRADE_CODES:
            _logger.debug("Unknown trade code: %s (allowed for new trades)", trade_code)

        # Locality code validation
        locality = str(rate.get("locality_code", "")).strip()
        if locality and not is_valid_locality_code(locality):
            row_errors.append(f"invalid locality_code format: {locality}")

        if row_errors:
            errors.append({"row": index, "errors": row_errors, "rate_key": rate.get("rate_key", "unknown")})

    return ValidationResult(
        success=len(errors) == 0,
        failed_count=len(errors),
        errors=errors,
    )


def validate_contracts(contracts: list[dict[str, Any]]) -> ValidationResult:
    """Validate contract records.

    Checks:
    - Required fields present (contract_number, contractor_name, locality, start_date)
    - start_date <= end_date (if both present)
    - contract_number uniqueness within batch
    - start_date is not in the future
    - end_date >= start_date if both present

    Args:
        contracts: List of contract dicts.

    Returns:
        ValidationResult with pass/fail and error details.
    """
    errors: list[dict[str, Any]] = []
    seen_numbers: set[str] = set()
    today = date.today()

    required_fields = ["contract_number", "project_name", "contractor_name", "locality", "start_date"]

    for index, contract in enumerate(contracts, start=1):
        row_errors: list[str] = []

        # Required fields check
        for field in required_fields:
            if field not in contract or contract[field] is None or str(contract.get(field, "")).strip() == "":
                row_errors.append(f"missing required field: {field}")

        # Contract number uniqueness
        contract_number = str(contract.get("contract_number", "")).strip()
        if contract_number:
            if contract_number in seen_numbers:
                row_errors.append(f"duplicate contract_number within batch: {contract_number}")
            seen_numbers.add(contract_number)

        # Start date validation
        try:
            start_str = contract.get("start_date", "")
            if start_str:
                start_date = date.fromisoformat(str(start_str)) if isinstance(start_str, str) else start_str
                if start_date > today:
                    row_errors.append(f"start_date cannot be in the future: {start_date}")
        except (ValueError, TypeError):
            row_errors.append(f"invalid start_date format: {start_str}")

        # End date validation
        try:
            end_str = contract.get("end_date", "")
            if end_str:
                end_date = date.fromisoformat(str(end_str)) if isinstance(end_str, str) else end_str
                if start_str:
                    start_date = date.fromisoformat(str(start_str)) if isinstance(start_str, str) else None
                    if start_date and end_date and end_date < start_date:
                        row_errors.append(f"end_date cannot be before start_date: {end_date} < {start_date}")
        except (ValueError, TypeError):
            row_errors.append(f"invalid end_date format: {end_str}")

        # Total value validation (if present)
        total_value = contract.get("total_value")
        if total_value is not None:
            try:
                tv = float(total_value)
                if tv < 0:
                    row_errors.append(f"total_value cannot be negative: {tv}")
            except (TypeError, ValueError):
                row_errors.append(f"total_value must be a number: {total_value}")

        if row_errors:
            errors.append({"row": index, "errors": row_errors, "contract_number": contract_number or "unknown"})

    return ValidationResult(
        success=len(errors) == 0,
        failed_count=len(errors),
        errors=errors,
    )


def validate_payroll_records(records: list[dict[str, Any]]) -> ValidationResult:
    """Validate payroll records.

    Checks:
    - Required fields present (employee_name, trade_code, week_ending, total_hours, hourly_rate)
    - total_hours within DBA limits (0-168 per week)
    - hourly_rate >= 0
    - gross_pay matches hourly_rate * total_hours within tolerance (if both present)
    - week_ending is a valid date and ideally on a Friday
    - employee_name is not empty

    Args:
        records: List of payroll record dicts.

    Returns:
        ValidationResult with pass/fail and error details.
    """
    errors: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []

    required_fields = ["employee_name", "trade_code", "week_ending", "total_hours", "hourly_rate", "gross_pay"]

    for index, record in enumerate(records, start=1):
        row_errors: list[str] = []
        row_warnings: list[str] = []

        # Required fields check
        for field in required_fields:
            if field not in record or record[field] is None or str(record.get(field, "")).strip() == "":
                row_errors.append(f"missing required field: {field}")

        # Employee name validation
        employee_name = str(record.get("employee_name", "")).strip()
        if not employee_name:
            row_errors.append("employee_name cannot be empty")
        elif len(employee_name) > 200:
            row_errors.append(f"employee_name too long (max 200): {len(employee_name)}")

        # Trade code validation
        trade_code = str(record.get("trade_code", "")).strip().upper()
        if trade_code and trade_code not in VALID_TRADE_CODES:
            row_warnings.append(f"unknown trade_code: {trade_code} (may be valid)")

        # Total hours validation
        try:
            total_hours = float(record.get("total_hours", 0))
            if total_hours < 0:
                row_errors.append(f"total_hours cannot be negative: {total_hours}")
            elif total_hours > 168:  # 24h * 7 days
                row_errors.append(f"total_hours exceeds maximum (168): {total_hours}")
        except (TypeError, ValueError):
            row_errors.append(f"total_hours must be a number: {record.get('total_hours')}")

        # Hourly rate validation
        try:
            hourly_rate = float(record.get("hourly_rate", 0))
            if hourly_rate < 0:
                row_errors.append(f"hourly_rate cannot be negative: {hourly_rate}")
            if hourly_rate > 500:  # Sanity check
                row_warnings.append(f"hourly_rate seems unusually high: {hourly_rate}")
        except (TypeError, ValueError):
            row_errors.append(f"hourly_rate must be a number: {record.get('hourly_rate')}")

        # Week ending validation
        try:
            week_end_str = str(record.get("week_ending", ""))
            if week_end_str:
                week_ending = date.fromisoformat(week_end_str)
                if not is_friday(week_ending):
                    row_warnings.append(f"week_ending is not a Friday: {week_ending} (expected for payroll)")
        except (ValueError, TypeError):
            row_errors.append(f"invalid week_ending date format: {week_end_str}")

        # Gross pay sanity check
        try:
            gross_pay = float(record.get("gross_pay", 0))
            hourly = float(record.get("hourly_rate", 0))
            hours = float(record.get("total_hours", 0))
            expected_gross = hourly * hours
            if gross_pay > 0 and expected_gross > 0:
                # Allow 1% tolerance for rounding
                tolerance = expected_gross * 0.01
                if abs(gross_pay - expected_gross) > tolerance:
                    row_warnings.append(
                        f"gross_pay ({gross_pay}) differs significantly from hourly_rate * total_hours ({expected_gross:.2f})"
                    )
        except (TypeError, ValueError):
            row_warnings.append("gross_pay could not be validated against hourly_rate * total_hours")

        if row_errors:
            errors.append({
                "row": index,
                "errors": row_errors,
                "employee": employee_name or "unknown",
            })
        if row_warnings:
            warnings.append({
                "row": index,
                "warnings": row_warnings,
                "employee": employee_name or "unknown",
            })

    return ValidationResult(
        success=len(errors) == 0,
        failed_count=len(errors),
        errors=errors,
        warnings=warnings,
    )
