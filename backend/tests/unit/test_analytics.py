"""Tests for V4 analytics router and query functions."""

from decimal import Decimal


from wcp_backend.analytics.router import (
    AnalyticsOverview,
    DecisionVolumeEntry,
    LLMResponse,
    WagesResponse,
    ComplianceResponse,
)


class TestAnalyticsOverview:
    """Tests for analytics_overview endpoint."""

    def test_overview_model_accepts_all_fields(self) -> None:
        overview = AnalyticsOverview(
            total_decisions=100,
            total_contracts=10,
            avg_trust_score=0.87,
            overall_approval_rate=86.5,
            human_review_queue_depth=5,
            decisions_this_month=42,
            total_cost_usd=12.50,
            avg_cost_per_decision=0.125,
            note="test data",
        )
        assert overview.total_decisions == 100
        assert overview.total_contracts == 10
        assert overview.avg_cost_per_decision == 0.125

    def test_overview_model_defaults(self) -> None:
        overview = AnalyticsOverview()
        assert overview.total_decisions == 0
        assert overview.total_contracts == 0
        assert overview.avg_cost_per_decision == 0.0


class TestDecisionVolumeEntry:
    """Tests for DecisionVolumeEntry model."""

    def test_entry_accepts_all_fields(self) -> None:
        entry = DecisionVolumeEntry(
            date="2025-04-01",
            decisions=45,
            avg_trust=0.87,
            approval_rate=84.4,
        )
        assert entry.date == "2025-04-01"
        assert entry.decisions == 45
        assert entry.avg_trust == 0.87
        assert entry.approval_rate == 84.4


class TestWagesResponse:
    """Tests for WagesResponse model."""

    def test_wages_response_defaults(self) -> None:
        resp = WagesResponse()
        assert resp.violation_trend == []
        assert resp.actual_vs_required == []
        assert resp.fringe_compliance == []
        assert resp.note == ""


class TestLLMResponse:
    """Tests for LLMResponse model."""

    def test_llm_response_defaults(self) -> None:
        resp = LLMResponse()
        assert resp.cost_per_decision == []
        assert resp.token_usage == []
        assert resp.model_distribution == []
        assert resp.latency_by_model == []
        assert resp.note != ""


class TestComplianceResponse:
    """Tests for ComplianceResponse model."""

    def test_compliance_defaults(self) -> None:
        resp = ComplianceResponse()
        assert resp.by_trade == []
        assert resp.by_locality == []
        assert resp.violation_types == []


class TestAnalyticsQueriesMocked:
    """Tests for analytics query functions using mocked sessions."""

    def test_safe_float_handles_none(self) -> None:
        from wcp_backend.analytics.queries import _safe_float
        assert _safe_float(None) == 0.0
        assert _safe_float(None, default=1.0) == 1.0
        assert _safe_float(0.5) == 0.5
        assert _safe_float("invalid") == 0.0

    def test_safe_int_handles_none(self) -> None:
        from wcp_backend.analytics.queries import _safe_int
        assert _safe_int(None) == 0
        assert _safe_int(None, default=5) == 5
        assert _safe_int(42) == 42
        assert _safe_int("invalid") == 0

    def test_safe_float_with_decimal(self) -> None:
        from wcp_backend.analytics.queries import _safe_float
        assert _safe_float(Decimal("3.14")) == 3.14

    def test_safe_int_with_decimal(self) -> None:
        from wcp_backend.analytics.queries import _safe_int
        assert _safe_int(Decimal("42")) == 42