"""Events — Pydantic v2 event schemas for Redis Streams (V4).

Provides:
- DecisionEvent: Emitted on decision persist
- PayrollIngestedEvent: Emitted on successful payroll bulk import  
- ContractCreatedEvent: Emitted on contract creation

All events use Pydantic BaseModel for serialization and validation.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field

__all__ = [
    "DecisionEvent",
    "PayrollIngestedEvent",
    "ContractCreatedEvent",
    "IngestionEvent",
    "ModuleMetadata",
]


class ModuleMetadata(BaseModel):
    """Module identity for V4 scaffold verification."""

    MODULE_NAME: str = "events"
    MODULE_OWNER: str = "v4"


class DecisionEvent(BaseModel):
    """Decision event emitted to Redis Streams on decision persist.

    Emitted whenever a decision is persisted to the database.
    Downstream consumers (agent gateway) read from the decisions:stream
    to push real-time SSE updates to frontend analytics pages.
    """

    decision_id: str = Field(description="Unique decision UUID")
    contract_id: str | None = Field(default=None, description="Linked contract ID")
    verdict: str = Field(description="approved | revise | reject")
    trust_score: float = Field(ge=0.0, le=1.0, description="Trust score 0-1")
    trust_band: str = Field(description="high | medium | low")
    requires_human_review: bool = Field(default=False)
    violation_count: int = Field(ge=0, default=0)
    warning_count: int = Field(ge=0, default=0)
    cost_usd: float | None = Field(default=None, ge=0.0)
    latency_ms: int | None = Field(default=None, ge=0)
    trade_code: str | None = Field(default=None)
    locality: str | None = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def to_redis_payload(self) -> dict[str, str]:
        """Serialize to Redis XADD payload dict."""
        return {"event": self.model_dump_json()}


class PayrollIngestedEvent(BaseModel):
    """Payroll ingested event emitted after bulk payroll import completes."""

    job_id: str = Field(description="Ingestion job ID")
    contract_id: str = Field(description="Contract this payroll belongs to")
    total_records: int = Field(ge=0, description="Total records in import batch")
    processed_records: int = Field(ge=0, default=0, description="Successfully processed")
    failed_records: int = Field(ge=0, default=0, description="Failed records")
    source_reference: str | None = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def to_redis_payload(self) -> dict[str, str]:
        return {"event": self.model_dump_json()}


class ContractCreatedEvent(BaseModel):
    """Contract created event emitted after contract insertion."""

    contract_id: str = Field(description="New contract UUID")
    contract_number: str = Field(description="Unique contract number")
    contractor_name: str = Field(description="Prime contractor name")
    locality: str = Field(description="Project locality")
    start_date: datetime = Field(description="Contract start date")
    total_value: float | None = Field(default=None, ge=0.0)
    status: str = Field(default="active")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def to_redis_payload(self) -> dict[str, str]:
        return {"event": self.model_dump_json()}


class IngestionEvent(BaseModel):
    """Generic ingestion event for tracking job lifecycle."""

    job_id: str
    job_type: str = Field(description="contract_import | payroll_import | dbwd_refresh")
    status: str = Field(description="pending | processing | completed | failed | partial")
    total_records: int = Field(ge=0, default=0)
    processed_records: int = Field(ge=0, default=0)
    failed_records: int = Field(ge=0, default=0)
    error_details: list[dict[str, Any]] = Field(default_factory=list)
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def to_redis_payload(self) -> dict[str, str]:
        return {"event": self.model_dump_json()}