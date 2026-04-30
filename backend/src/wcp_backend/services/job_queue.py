"""Celery task definitions for async job processing."""

from __future__ import annotations

import asyncio
import time
from datetime import datetime
from typing import Any

from celery import Celery  # type: ignore[import-untyped]

from wcp_backend.config import settings
from wcp_backend.models.enums import TrustBand, VerdictStatus
from wcp_backend.models.schemas import TrustScoredDecision
from wcp_backend.pipeline.extraction import extract_from_text
from wcp_backend.pipeline.rules import (
    determine_trust_band,
    run_rule_engine,
)
from wcp_backend.services.audit import append_audit_event, persist_decision

celery_app = Celery(
    "wcp_backend",
    broker=settings.celery_broker_url,
    backend=settings.celery_broker_url,
)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
)


async def _process_single_payload(
    idx: int,
    payload: dict[str, Any],
    batch_job_id: str,
    start_time: float,
) -> dict[str, Any]:
    """Process a single payload from a batch."""
    try:
        text = payload.get("text", "")
        if not text:
            return {"index": idx, "status": "error", "error": "Empty text"}

        # Extract
        extracted = extract_from_text(text)

        # Validate (deterministic only — Phase 2)
        report = await run_rule_engine(extracted)

        # Build deterministic-only decision
        verdict = (
            VerdictStatus.APPROVED
            if report.overall_status.value == "pass"
            else VerdictStatus.REJECTED
        )
        deterministic_score = 1.0 - (report.violation_count / max(len(report.checks), 1))
        trust_score = deterministic_score  # Phase 2: deterministic only
        trust_band = determine_trust_band(trust_score)

        # Summarize reasoning
        violation_msgs = [c.message for c in report.checks if c.status.value == "fail"]
        reasoning = (
            "No violations found."
            if not violation_msgs
            else "Violations: " + "; ".join(violation_msgs)
        )

        decision = TrustScoredDecision(
            job_id=extracted.job_id,
            verdict=verdict,
            trust_score=trust_score,
            trust_band=trust_band,
            requires_human_review=(trust_band == TrustBand.REQUIRE_HUMAN_REVIEW),
            violation_count=report.violation_count,
            warning_count=report.warning_count,
            llm_confidence=0.0,
            reasoning_summary=reasoning,
            citations=[],
            cost_usd=0.0,
            latency_ms=int((time.time() - start_time) * 1000),
            phoenix_trace_id="",
            created_at=datetime.utcnow(),
        )

        # Persist
        decision_id = await persist_decision(decision)
        await append_audit_event(
            job_id=extracted.job_id,
            event_type="batch_decision_persisted",
            payload={
                "batch_job_id": batch_job_id,
                "index": idx,
                "decision_id": decision_id,
            },
        )

        return {
            "index": idx,
            "status": "completed",
            "job_id": extracted.job_id,
            "decision_id": decision_id,
            "verdict": verdict.value,
            "trust_score": trust_score,
        }

    except Exception as exc:
        return {"index": idx, "status": "error", "error": str(exc)}


@celery_app.task(bind=True, max_retries=3)  # type: ignore[untyped-decorator]
def process_payroll_batch(
    self: Any, job_id: str, payloads: list[dict[str, Any]]
) -> dict[str, Any]:
    """Process a batch of WCP payloads asynchronously."""
    start_time = time.time()

    async def _process() -> list[dict[str, Any]]:
        tasks = [
            _process_single_payload(idx, payload, job_id, start_time)
            for idx, payload in enumerate(payloads)
        ]
        return list(await asyncio.gather(*tasks))

    results = asyncio.run(_process())

    return {
        "batch_job_id": job_id,
        "processed": len(payloads),
        "results": results,
        "elapsed_ms": int((time.time() - start_time) * 1000),
    }


@celery_app.task  # type: ignore[untyped-decorator]
def run_eval(eval_config: dict[str, Any]) -> dict[str, Any]:
    """Run golden set evaluation in background."""
    import json as _json
    from pathlib import Path

    golden_path = Path(eval_config.get("golden_set_path", "tests/eval/golden_set.json"))
    if not golden_path.exists():
        return {"error": f"Golden set not found: {golden_path}"}

    with open(golden_path) as f:
        golden_set = _json.load(f)

    async def _evaluate() -> dict[str, Any]:
        correct = 0
        total = 0
        errors = 0
        details: list[dict[str, Any]] = []

        for example in golden_set:
            try:
                text = example.get("text", "")
                expected_verdict = example.get("expected_verdict")
                expected_trust_band = example.get("expected_trust_band")

                extracted = extract_from_text(text)
                report = await run_rule_engine(extracted)

                verdict = (
                    "approved"
                    if report.overall_status.value == "pass"
                    else "rejected"
                )
                deterministic_score = 1.0 - (
                    report.violation_count / max(len(report.checks), 1)
                )
                trust_band = determine_trust_band(deterministic_score).value

                verdict_correct = verdict == expected_verdict
                band_correct = trust_band == expected_trust_band
                is_correct = verdict_correct and band_correct

                if is_correct:
                    correct += 1
                total += 1

                details.append(
                    {
                        "id": example.get("id"),
                        "verdict_correct": verdict_correct,
                        "band_correct": band_correct,
                        "overall_correct": is_correct,
                        "predicted_verdict": verdict,
                        "predicted_band": trust_band,
                    }
                )
            except Exception as exc:
                errors += 1
                total += 1
                details.append(
                    {
                        "id": example.get("id"),
                        "error": str(exc),
                    }
                )

        return {
            "correct": correct,
            "total": total,
            "errors": errors,
            "accuracy": round(correct / total, 4) if total > 0 else 0.0,
            "details": details,
        }

    return asyncio.run(_evaluate())
