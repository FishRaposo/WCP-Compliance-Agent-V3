"""Golden set tests using flat text inputs through the extraction pipeline.

These tests exercise extract_from_text → run_rule_engine end-to-end.
They are more realistic but less precise than the structured golden set
because text extraction is inherently lossy.

Marked with ``@pytest.mark.eval`` — same as the structured golden set.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from wcp_backend.models.enums import OverallStatus, VerdictStatus
from wcp_backend.pipeline.extraction import extract_from_text
from wcp_backend.pipeline.rules import run_rule_engine

GOLDEN_SET_TEXT_PATH = Path(__file__).parent / "golden_set_text.json"


def _load_text_examples() -> list[dict]:
    with open(GOLDEN_SET_TEXT_PATH) as f:
        return json.load(f)


TEXT_EXAMPLES = _load_text_examples()


def _build_wh347_text(input_text: str) -> str:
    """Wrap the compact text input into a WH-347-like document structure."""
    return f"""
    Contractor: Test Contractor LLC
    Project: Federal Compliance Test
    Location: Washington, DC
    Certified: 2026-06-01
    Payroll # 1
    Week Ending: 2026-06-07

    {input_text}
    """


@pytest.mark.eval
@pytest.mark.parametrize(
    "example",
    TEXT_EXAMPLES,
    ids=[e["id"] for e in TEXT_EXAMPLES],
)
async def test_golden_set_text(example: dict) -> None:
    """Run a text-format golden set example through extract → rule engine."""
    wh347_text = _build_wh347_text(example["input_text"])

    extracted = extract_from_text(wh347_text)
    assert len(extracted.employees) >= 1, f"No employees extracted for {example['id']}"

    report = await run_rule_engine(extracted)

    verdict = (
        VerdictStatus.APPROVED
        if report.overall_status == OverallStatus.PASS
        else VerdictStatus.REJECTED
    )

    expected = example["expected_verdict"]
    assert verdict.value == expected, (
        f"[{example['id']}] Expected {expected}, got {verdict.value}. "
        f"Violations: {report.violation_count}, Warnings: {report.warning_count}. "
        f"Checks: {[c.check_type + ':' + c.status for c in report.checks]}"
    )
