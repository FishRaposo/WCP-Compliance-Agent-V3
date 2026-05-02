"""Audit persistence — immutable decision and event records in PostgreSQL."""

from __future__ import annotations

import json

from sqlalchemy import text

from wcp_backend.models.schemas import AuditEvent, TrustScoredDecision
from wcp_backend.services.db import engine


async def persist_decision(decision: TrustScoredDecision) -> str:
    """Write a finalized decision to the audit table. Returns the decision_id."""
    async with engine.connect() as conn:
        result = await conn.execute(
            text("""
                INSERT INTO decisions (
                    job_id, verdict, trust_score, trust_band,
                    requires_human_review, violation_count, warning_count,
                    reasoning_summary, citations, cost_usd, latency_ms,
                    phoenix_trace_id, created_at
                ) VALUES (
                    :job_id, :verdict, :trust_score, :trust_band,
                    :requires_human_review, :violation_count, :warning_count,
                    :reasoning_summary, :citations::jsonb, :cost_usd, :latency_ms,
                    :phoenix_trace_id, COALESCE(:created_at, NOW())
                )
                RETURNING id
            """),
            {
                "job_id": decision.job_id,
                "verdict": decision.verdict.value,
                "trust_score": decision.trust_score,
                "trust_band": decision.trust_band.value,
                "requires_human_review": decision.requires_human_review,
                "violation_count": decision.violation_count,
                "warning_count": decision.warning_count,
                "reasoning_summary": decision.reasoning_summary,
                "citations": json.dumps(
                    [c.model_dump() for c in (decision.citations or [])]
                ),
                "cost_usd": decision.cost_usd,
                "latency_ms": decision.latency_ms,
                "phoenix_trace_id": decision.phoenix_trace_id,
                "created_at": decision.created_at,
            },
        )
        row = result.fetchone()
        if row is None:
            raise RuntimeError("INSERT INTO decisions did not return an id")
        await conn.commit()
        return str(row.id)


async def append_audit_event(
    job_id: str,
    event_type: str,
    payload: dict[str, object],
    regulation_refs: list[str] | None = None,
    trace_id: str = "",
) -> AuditEvent:
    """Append an immutable audit event for the given job."""
    async with engine.connect() as conn:
        result = await conn.execute(
            text("""
                INSERT INTO audit_events (
                    job_id, event_type, actor, payload,
                    regulation_references, trace_id
                ) VALUES (
                    :job_id, :event_type, :actor, :payload::jsonb,
                    :regulation_references, :trace_id
                )
                RETURNING id, job_id, event_type, actor, payload,
                          regulation_references, trace_id, created_at
            """),
            {
                "job_id": job_id,
                "event_type": event_type,
                "actor": payload.get("actor", "system"),
                "payload": json.dumps(payload),
                "regulation_references": regulation_refs or [],
                "trace_id": trace_id,
            },
        )
        row = result.fetchone()
        if row is None:
            raise RuntimeError("INSERT INTO audit_events did not return a row")
        await conn.commit()

        return AuditEvent(
            event_id=row.id,
            job_id=row.job_id,
            event_type=row.event_type,
            timestamp=row.created_at,
            actor=row.actor,
            payload=row.payload,
            regulation_references=row.regulation_references or [],
            trace_id=row.trace_id or "",
        )
