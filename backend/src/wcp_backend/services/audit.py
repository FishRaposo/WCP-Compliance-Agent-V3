"""Audit persistence — immutable decision and event records in PostgreSQL."""

from __future__ import annotations

from wcp_backend.models.schemas import AuditEvent, TrustScoredDecision


async def persist_decision(decision: TrustScoredDecision) -> str:
    """Write a finalized decision to the audit table. Returns the decision_id."""
    # TODO: implement — INSERT INTO decisions
    raise NotImplementedError


async def append_audit_event(
    job_id: str, event_type: str, payload: dict, regulation_refs: list[str] | None = None
) -> AuditEvent:
    """Append an immutable audit event for the given job."""
    # TODO: implement — INSERT INTO audit_events
    raise NotImplementedError
