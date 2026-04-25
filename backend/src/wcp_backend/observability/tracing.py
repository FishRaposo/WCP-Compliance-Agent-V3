"""OpenTelemetry span helpers for cross-service tracing."""

from __future__ import annotations

from contextlib import contextmanager
from typing import Generator

from opentelemetry import trace
from opentelemetry.trace import Span


@contextmanager
def span(name: str, attributes: dict | None = None) -> Generator[Span, None, None]:
    tracer = trace.get_tracer("wcp_backend")
    with tracer.start_as_current_span(name) as s:
        if attributes:
            for k, v in attributes.items():
                s.set_attribute(k, v)
        yield s
