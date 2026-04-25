"""Initialize Arize Phoenix tracer for LLM observability."""

from __future__ import annotations

from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry import trace

from wcp_backend.config import settings


def init_phoenix() -> None:
    """Configure OpenTelemetry to export spans to Phoenix."""
    exporter = OTLPSpanExporter(endpoint=settings.phoenix_collector_endpoint)
    provider = TracerProvider()
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
