"""OpenTelemetry span helpers for cross-service tracing."""

from __future__ import annotations

import asyncio
import functools
from contextlib import contextmanager
from typing import Any, Callable, Generator, TypeVar

from opentelemetry import trace
from opentelemetry.trace import Span

F = TypeVar("F", bound=Callable[..., Any])

_TRACER_NAME = "wcp_backend"


@contextmanager
def span(name: str, attributes: dict[str, Any] | None = None) -> Generator[Span, None, None]:
    """Context manager for creating a trace span.

    Args:
        name: Span name
        attributes: Optional dict of span attributes

    Yields:
        The Span object
    """
    tracer = trace.get_tracer(_TRACER_NAME)
    with tracer.start_as_current_span(name) as s:
        if attributes:
            for k, v in attributes.items():
                s.set_attribute(k, v)
        yield s


def trace_span(name: str | None = None, attributes: dict[str, Any] | None = None) -> Callable[[F], F]:
    """Decorator to trace a function with a span (supports both sync and async).

    Usage:
        @trace_span("extract_text")
        def extract_from_text(text: str) -> ExtractedWCP:
            ...

        @trace_span("run_rules")
        async def run_rule_engine(extracted: ExtractedWCP) -> DeterministicReport:
            ...

    Args:
        name: Span name (defaults to function name)
        attributes: Optional dict of span attributes to set

    Returns:
        Decorated function
    """
    span_name = name
    extra_attrs = attributes

    def _set_span_attrs(s: Span, func: Callable[..., Any]) -> None:
        s.set_attribute("function.name", func.__name__)
        s.set_attribute("function.module", func.__module__)
        if extra_attrs:
            for k, v in extra_attrs.items():
                s.set_attribute(k, v)
        s.set_attribute("function.args_count", 0)  # placeholder; actual count varies

    def decorator(func: F) -> F:
        func_span_name = span_name or func.__name__
        is_async = asyncio.iscoroutinefunction(func)

        @functools.wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            tracer = trace.get_tracer(_TRACER_NAME)
            with tracer.start_as_current_span(func_span_name) as s:
                _set_span_attrs(s, func)
                try:
                    result = func(*args, **kwargs)
                    s.set_attribute("function.success", True)
                    return result
                except Exception as e:
                    s.set_attribute("function.success", False)
                    s.set_attribute("error.type", type(e).__name__)
                    s.set_attribute("error.message", str(e))
                    raise

        @functools.wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            tracer = trace.get_tracer(_TRACER_NAME)
            with tracer.start_as_current_span(func_span_name) as s:
                _set_span_attrs(s, func)
                try:
                    result = await func(*args, **kwargs)
                    s.set_attribute("function.success", True)
                    return result
                except Exception as e:
                    s.set_attribute("function.success", False)
                    s.set_attribute("error.type", type(e).__name__)
                    s.set_attribute("error.message", str(e))
                    raise

        return async_wrapper if is_async else sync_wrapper  # type: ignore[return-value]

    return decorator
