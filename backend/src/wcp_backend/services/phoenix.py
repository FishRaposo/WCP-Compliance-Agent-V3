"""Arize Phoenix tracing client — wraps span creation for compliance pipeline."""

from __future__ import annotations

from contextlib import AbstractContextManager
from typing import Any

from opentelemetry import trace

tracer = trace.get_tracer("wcp_backend")


def trace_extraction(job_id: str) -> AbstractContextManager[Any]:
    """Context manager for tracing the extraction layer."""
    return tracer.start_as_current_span(f"extraction:{job_id}")


def trace_validation(job_id: str) -> AbstractContextManager[Any]:
    """Context manager for tracing the validation layer."""
    return tracer.start_as_current_span(f"validation:{job_id}")


def trace_verdict(job_id: str) -> AbstractContextManager[Any]:
    """Context manager for tracing the LLM verdict layer."""
    return tracer.start_as_current_span(f"verdict:{job_id}")
