"""Custom metrics — decision latency, token usage, trust score distribution."""

from __future__ import annotations

from opentelemetry import metrics

meter = metrics.get_meter("wcp_backend")

decision_latency = meter.create_histogram(
    "wcp.decision.latency_ms",
    description="End-to-end decision latency in milliseconds",
    unit="ms",
)

token_usage_counter = meter.create_counter(
    "wcp.llm.tokens_total",
    description="Total LLM tokens consumed",
)

trust_score_histogram = meter.create_histogram(
    "wcp.decision.trust_score",
    description="Distribution of trust scores for completed decisions",
)
