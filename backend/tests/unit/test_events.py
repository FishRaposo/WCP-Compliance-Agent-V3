"""Tests for V4 events schemas and producer."""

from datetime import datetime

import pytest

from wcp_backend.events.schemas import (
    DecisionEvent,
    PayrollIngestedEvent,
    ContractCreatedEvent,
    IngestionEvent,
)


class TestDecisionEvent:
    """Tests for DecisionEvent Pydantic model."""

    def test_accepts_all_fields(self) -> None:
        event = DecisionEvent(
            decision_id="dec-123",
            contract_id="contract-456",
            verdict="approved",
            trust_score=0.87,
            trust_band="high",
            requires_human_review=False,
            violation_count=0,
            warning_count=0,
            cost_usd=0.12,
            latency_ms=1800,
            trade_code="ELEC",
            locality="Boston, MA",
            created_at=datetime(2025, 4, 30, 14, 30, 0),
        )
        assert event.decision_id == "dec-123"
        assert event.verdict == "approved"
        assert event.trust_score == 0.87
        assert event.trust_band == "high"
        assert event.cost_usd == 0.12

    def test_optional_fields_default(self) -> None:
        event = DecisionEvent(
            decision_id="dec-123",
            verdict="approved",
            trust_score=0.87,
            trust_band="high",
        )
        assert event.contract_id is None
        assert event.violation_count == 0
        assert event.requires_human_review is False

    def test_trust_score_range_validation(self) -> None:
        with pytest.raises(Exception):
            DecisionEvent(
                decision_id="dec-123",
                verdict="approved",
                trust_score=1.5,  # > 1.0 should fail
                trust_band="high",
            )

    def test_to_redis_payload(self) -> None:
        event = DecisionEvent(
            decision_id="dec-123",
            verdict="approved",
            trust_score=0.87,
            trust_band="high",
        )
        payload = event.to_redis_payload()
        assert "event" in payload
        assert "dec-123" in payload["event"]


class TestPayrollIngestedEvent:
    """Tests for PayrollIngestedEvent Pydantic model."""

    def test_accepts_all_fields(self) -> None:
        event = PayrollIngestedEvent(
            job_id="job-123",
            contract_id="contract-456",
            total_records=100,
            processed_records=95,
            failed_records=5,
            source_reference="payroll.csv",
            created_at=datetime(2025, 4, 30, 10, 0, 0),
        )
        assert event.job_id == "job-123"
        assert event.total_records == 100
        assert event.processed_records == 95
        assert event.failed_records == 5

    def test_to_redis_payload(self) -> None:
        event = PayrollIngestedEvent(
            job_id="job-123",
            contract_id="contract-456",
            total_records=100,
        )
        payload = event.to_redis_payload()
        assert "event" in payload


class TestContractCreatedEvent:
    """Tests for ContractCreatedEvent Pydantic model."""

    def test_accepts_all_fields(self) -> None:
        event = ContractCreatedEvent(
            contract_id="contract-123",
            contract_number="GS-001",
            contractor_name="Acme Corp",
            locality="Boston, MA",
            start_date=datetime(2025, 1, 15),
            total_value=2500000.0,
            status="active",
        )
        assert event.contract_number == "GS-001"
        assert event.total_value == 2500000.0

    def test_defaults(self) -> None:
        event = ContractCreatedEvent(
            contract_id="contract-123",
            contract_number="GS-001",
            contractor_name="Acme Corp",
            locality="Boston, MA",
            start_date=datetime(2025, 1, 15),
        )
        assert event.total_value is None
        assert event.status == "active"


class TestIngestionEvent:
    """Tests for IngestionEvent Pydantic model."""

    def test_accepts_all_fields(self) -> None:
        event = IngestionEvent(
            job_id="job-123",
            job_type="contract_import",
            status="completed",
            total_records=100,
            processed_records=98,
            failed_records=2,
            error_details=[{"row": 5, "error": "invalid data"}],
            started_at=datetime(2025, 4, 30, 9, 0, 0),
            completed_at=datetime(2025, 4, 30, 9, 5, 0),
        )
        assert event.job_id == "job-123"
        assert event.status == "completed"
        assert event.processed_records == 98
        assert len(event.error_details) == 1

    def test_to_redis_payload(self) -> None:
        event = IngestionEvent(
            job_id="job-123",
            job_type="contract_import",
            status="processing",
            total_records=100,
        )
        payload = event.to_redis_payload()
        assert "event" in payload