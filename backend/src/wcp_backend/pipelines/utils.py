"""Prefect ETL — Utility helpers (V4).

Purpose: Shared Prefect task helpers and utilities for all ETL flows.

Provides:
- Database connection helpers
- Prefect task decorators
- Retry and timeout configuration
- Shared GE validation runners
"""

from __future__ import annotations

from collections.abc import Callable
from functools import wraps
from typing import Any, TypeVar

from wcp_backend.quality import ValidationResult
from wcp_backend.quality.contract_expectations import validate_contracts
from wcp_backend.quality.dbwd_expectations import validate_dbwd_rates
from wcp_backend.quality.payroll_expectations import validate_payroll_records

__all__ = [
    "task_retry",
    "task_timeout",
    "run_ge_validation",
    "get_pg_connection",
    "prefect_flow",
    "prefect_task",
]

F = TypeVar("F", bound=Callable[..., Any])


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
    validators = {
        "dbwd": validate_dbwd_rates,
        "dbwd_rates": validate_dbwd_rates,
        "contracts": validate_contracts,
        "payroll": validate_payroll_records,
        "payroll_records": validate_payroll_records,
    }
    validator = validators.get(expectation_suite)
    if validator is None:
        raise ValueError(f"Unknown V4 validation suite: {expectation_suite}")
    result: ValidationResult = validator(data)
    return result.model_dump()


def get_pg_connection() -> object:
    """Get a PostgreSQL connection for ETL tasks.

    Returns:
        DBAPI connection object.
    """
    from wcp_backend.services.db import async_session

    return async_session


def prefect_flow(*flow_args: Any, **flow_kwargs: Any) -> Callable[[F], F]:
    """Use Prefect's flow decorator when available, with an import-safe fallback."""
    try:
        from prefect import flow

        return flow(*flow_args, **flow_kwargs)
    except Exception:
        def decorator(func: F) -> F:
            return func

        return decorator


def prefect_task(*task_args: Any, **task_kwargs: Any) -> Callable[[F], F]:
    """Use Prefect's task decorator when available, with an import-safe fallback."""
    try:
        from prefect import task

        return task(*task_args, **task_kwargs)
    except Exception:
        def decorator(func: F) -> F:
            @wraps(func)
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                return await func(*args, **kwargs)

            @wraps(func)
            def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
                return func(*args, **kwargs)

            return (async_wrapper if _is_coroutine_function(func) else sync_wrapper)  # type: ignore[return-value]

        return decorator


def _is_coroutine_function(func: Callable[..., Any]) -> bool:
    import inspect

    return inspect.iscoroutinefunction(func)
