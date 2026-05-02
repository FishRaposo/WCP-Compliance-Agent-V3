"""Events — Redis Streams producer and Pydantic event schemas (V4).

Responsibilities:
- emit_decision_event(): XADD to decisions:stream on decision persist
- DecisionEvent Pydantic model (events/schemas.py)
- Best-effort / non-blocking: if Redis is unavailable, events are logged but
  do not raise errors or block the calling code.

Key files (V4 spec):
- events/producer.py — emit_decision_event() function
- events/schemas.py — DecisionEvent Pydantic model
"""

from __future__ import annotations

from wcp_backend.events.producer import emit_decision_event, emit_payroll_ingested_event, emit_decision_event_sync
from wcp_backend.events.schemas import DecisionEvent, PayrollIngestedEvent, ContractCreatedEvent, IngestionEvent

MODULE_NAME = "events"
MODULE_OWNER = "v4"

__all__ = [
    "MODULE_NAME",
    "MODULE_OWNER",
    "emit_decision_event",
    "emit_payroll_ingested_event",
    "emit_decision_event_sync",
    "DecisionEvent",
    "PayrollIngestedEvent",
    "ContractCreatedEvent",
    "IngestionEvent",
]