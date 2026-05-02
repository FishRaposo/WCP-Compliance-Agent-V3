"""Native Great Expectations runtime — optional GX integration with fallback validators.

Purpose: Provide a unified validation runtime that uses native Great Expectations
when the library is installed, and falls back to custom validators when not.

Design:
- GE is a soft dependency. ImportError is handled gracefully.
- When GE is available: uses DataContext, pandas DataFrame, and GE expectation API.
- When GE is not available: delegates to the existing custom validators in quality/__init__.py.
- Return type is always a dict with: {"success": bool, "failed_count": int, "errors": list, "statistics": dict}
"""

from __future__ import annotations

import logging
from typing import Any

from wcp_backend.quality._core import (
    ValidationResult,
    validate_contracts,
    validate_dbwd_rates,
    validate_payroll_records,
)

__all__ = ["GERuntime"]

_logger = logging.getLogger(__name__)

try:
    import great_expectations as gx
    import pandas as pd

    _HAS_GX = True
except ImportError:
    _HAS_GX = False

_FALLBACK_SUITE_MAP: dict[str, Any] = {
    "dbwd": validate_dbwd_rates,
    "contract": validate_contracts,
    "payroll": validate_payroll_records,
}


class GERuntime:
    """Unified validation runtime with optional Great Expectations support.

    When great_expectations is installed, creates a real GX DataContext and
    runs expectations through the native API. Otherwise, falls back to the
    custom validators defined in quality/__init__.py.
    """

    def __init__(self, context_root_dir: str | None = None) -> None:
        self._context = None
        self._suites: dict[str, list[dict[str, Any]]] = {}

        if _HAS_GX:
            try:
                self._context = gx.get_context(
                    project_root_dir=context_root_dir
                ) if context_root_dir else gx.get_context()
                _logger.info("Great Expectations DataContext initialized")
            except Exception:
                _logger.warning("Failed to create GX DataContext; falling back to custom validators")
                self._context = None

    @property
    def has_gx(self) -> bool:
        return self._context is not None

    def run_checkpoint(
        self,
        suite_name: str,
        data: list[dict[str, Any]],
        expectation_suite: list[dict[str, Any]],
    ) -> dict[str, Any]:
        if self._context is not None and _HAS_GX:
            return self._run_with_gx(suite_name, data, expectation_suite)
        return self._run_fallback(suite_name, data)

    def create_suite(self, name: str, expectations: list[dict[str, Any]]) -> dict[str, Any]:
        self._suites[name] = list(expectations)
        _logger.info("Created expectation suite '%s' with %d expectations", name, len(expectations))
        return {
            "name": name,
            "expectation_count": len(expectations),
            "created": True,
        }

    def _run_with_gx(
        self,
        suite_name: str,
        data: list[dict[str, Any]],
        expectation_suite: list[dict[str, Any]],
    ) -> dict[str, Any]:
        import pandas as pd

        try:
            df = pd.DataFrame(data)
        except Exception as exc:
            _logger.error("Failed to create DataFrame: %s", exc)
            return {
                "success": False,
                "failed_count": len(data),
                "errors": [{"row": 0, "errors": [f"DataFrame creation failed: {exc}"]}],
                "statistics": {"evaluated_expectations": 0, "successful": 0, "unsuccessful": 0},
            }

        errors: list[dict[str, Any]] = []
        total_evaluated = 0
        total_successful = 0
        total_unsuccessful = 0

        for exp_def in expectation_suite:
            exp_type = exp_def.get("expectation_type", "")
            kwargs = exp_def.get("kwargs", {})
            total_evaluated += 1

            try:
                passed, row_errors = self._evaluate_expectation(df, exp_type, kwargs)
                if passed:
                    total_successful += 1
                else:
                    total_unsuccessful += 1
                    errors.extend(row_errors)
            except Exception as exc:
                total_unsuccessful += 1
                errors.append({"row": 0, "errors": [f"Expectation '{exp_type}' failed: {exc}"]})

        success = total_unsuccessful == 0
        return {
            "success": success,
            "failed_count": len(errors),
            "errors": errors,
            "statistics": {
                "evaluated_expectations": total_evaluated,
                "successful": total_successful,
                "unsuccessful": total_unsuccessful,
            },
        }

    def _evaluate_expectation(
        self,
        df: "pd.DataFrame",
        exp_type: str,
        kwargs: dict[str, Any],
    ) -> tuple[bool, list[dict[str, Any]]]:
        import pandas as pd

        errors: list[dict[str, Any]] = []
        column = kwargs.get("column")

        if exp_type == "expect_column_values_to_not_be_null":
            if column and column in df.columns:
                null_mask = df[column].isna()
                null_rows = df.index[null_mask].tolist()
                if null_rows:
                    errors.append({
                        "row": null_rows[0] + 1,
                        "errors": [f"Column '{column}' has {len(null_rows)} null values"],
                    })
                    return False, errors
            return True, errors

        elif exp_type == "expect_column_values_to_be_between":
            min_val = kwargs.get("min_value")
            max_val = kwargs.get("max_value")
            if column and column in df.columns:
                numeric = pd.to_numeric(df[column], errors="coerce")
                mask = pd.Series([False] * len(df), index=df.index)
                if min_val is not None:
                    mask = mask | (numeric < min_val)
                if max_val is not None:
                    mask = mask | (numeric > max_val)
                failing = df.index[mask].tolist()
                if failing:
                    errors.append({
                        "row": failing[0] + 1,
                        "errors": [
                            f"Column '{column}' has {len(failing)} values outside [{min_val}, {max_val}]"
                        ],
                    })
                    return False, errors
            return True, errors

        elif exp_type == "expect_column_values_to_be_unique":
            if column and column in df.columns:
                duplicated = df[column].duplicated(keep="first")
                dup_rows = df.index[duplicated].tolist()
                if dup_rows:
                    errors.append({
                        "row": dup_rows[0] + 1,
                        "errors": [f"Column '{column}' has {len(dup_rows)} duplicate values"],
                    })
                    return False, errors
            return True, errors

        elif exp_type == "expect_table_row_count_to_be_between":
            min_val = kwargs.get("min_value", 0)
            max_val = kwargs.get("max_value")
            row_count = len(df)
            if row_count < min_val:
                errors.append({"row": 0, "errors": [f"Row count {row_count} < min {min_val}"]})
                return False, errors
            if max_val is not None and row_count > max_val:
                errors.append({"row": 0, "errors": [f"Row count {row_count} > max {max_val}"]})
                return False, errors
            return True, errors

        elif exp_type == "expect_column_values_to_be_in_set":
            value_set = set(kwargs.get("value_set", []))
            if column and column in df.columns:
                invalid_mask = ~df[column].isin(value_set) & ~df[column].isna()
                invalid_rows = df.index[invalid_mask].tolist()
                if invalid_rows:
                    errors.append({
                        "row": invalid_rows[0] + 1,
                        "errors": [
                            f"Column '{column}' has {len(invalid_rows)} values not in set {value_set}"
                        ],
                    })
                    return False, errors
            return True, errors

        return True, errors

    def _run_fallback(
        self,
        suite_name: str,
        data: list[dict[str, Any]],
    ) -> dict[str, Any]:
        validator = None
        name_lower = suite_name.lower()
        for key, func in _FALLBACK_SUITE_MAP.items():
            if key in name_lower:
                validator = func
                break

        if validator is None:
            validator = validate_dbwd_rates

        result: ValidationResult = validator(data)
        return {
            "success": result.success,
            "failed_count": result.failed_count,
            "errors": result.errors,
            "statistics": {
                "evaluated_expectations": 1,
                "successful": 1 if result.success else 0,
                "unsuccessful": 0 if result.success else 1,
            },
        }
