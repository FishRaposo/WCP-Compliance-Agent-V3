"""Golden set evaluation runner — pytest-benchmark integration."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from wcp_backend.models.enums import VerdictStatus
from wcp_backend.pipeline.extraction import extract_from_text
from wcp_backend.pipeline.rules import determine_trust_band, run_rule_engine

GOLDEN_SET_PATH = Path(__file__).parent / "golden_set.json"


def load_golden_set() -> list[dict]:
    return json.loads(GOLDEN_SET_PATH.read_text())


def _build_wh347_text(example: dict) -> str:
    """Convert structured golden-set input to WH-347 text format."""
    inp = example["input"]

    # Multi-employee examples
    if "employees" in inp:
        employees_text = ""
        for i, emp in enumerate(inp["employees"]):
            hw = emp.get("hours_worked", 0)
            wage = emp.get("hourly_wage", 0)
            employees_text += (
                f"\nName: Worker {i + 1}\n"
                f"Trade: {emp.get('trade_classification', 'Unknown')}\n"
                f"Hours: {hw}\n"
                f"Hourly Wage: {wage}\n"
                f"Fringe: {emp.get('fringe_benefits', 0.0)}\n"
                f"Gross: {hw * wage}\n"
                f"Deductions: 0.00\n"
                f"Net: {hw * wage}\n"
            )
        return (
            f"Contractor: Test Contractor\n"
            f"Project: Test Project\n"
            f"Location: {inp.get('locality', 'Washington, DC')}\n"
            f"Certified: 2026-01-15\n"
            f"{employees_text}"
        )

    # Empty input
    if "trade_classification" not in inp:
        return (
            "Contractor: Test Contractor\n"
            "Project: Test Project\n"
            "Location: Washington, DC\n"
            "Certified: 2026-01-15\n"
        )

    return f"""
Contractor: Test Contractor
Project: Test Project
Location: {inp.get("locality", "Washington, DC")}
Certified: 2026-01-15

Name: Test Worker
Trade: {inp["trade_classification"]}
Hours: {inp["hours_worked"]}
Hourly Wage: {inp["hourly_wage"]}
Fringe: {inp.get("fringe_benefits", 0.0)}
Gross: {inp["hours_worked"] * inp["hourly_wage"]}
Deductions: 0.00
Net: {inp["hours_worked"] * inp["hourly_wage"]}
"""


@pytest.mark.eval
@pytest.mark.parametrize("example", load_golden_set(), ids=lambda e: e["id"])
async def test_golden_example(example: dict) -> None:
    """Run each golden set example through the full pipeline and assert expected outcome."""
    text = _build_wh347_text(example)
    extracted = extract_from_text(text)
    report = await run_rule_engine(extracted)

    # Deterministic verdict
    verdict = (
        VerdictStatus.APPROVED
        if report.overall_status.value == "pass"
        else VerdictStatus.REJECTED
    )

    # Compute trust score (deterministic-only for Phase 2)
    deterministic_score = 1.0 - (
        report.violation_count / max(len(report.checks), 1)
    )
    trust_score = deterministic_score
    trust_band = determine_trust_band(trust_score)

    # Assert expected verdict
    expected_verdict = example["expected_verdict"]
    actual_verdict = verdict.value
    assert actual_verdict == expected_verdict, (
        f"Expected verdict {expected_verdict}, got {actual_verdict} "
        f"for {example['id']}"
    )

    # Assert minimum trust score
    min_trust = example.get("minimum_trust_score", 0.0)
    assert trust_score >= min_trust, (
        f"Trust score {trust_score:.2f} below minimum {min_trust} "
        f"for {example['id']}"
    )

    # Assert expected checks passed/failed
    if "expected_checks_passed" in example:
        passed_checks = {
            c.check_type.value for c in report.checks if c.status.value == "pass"
        }
        for check in example["expected_checks_passed"]:
            assert check in passed_checks, (
                f"Expected check {check} to pass for {example['id']}"
            )

    if "expected_checks_failed" in example:
        failed_checks = {
            c.check_type.value for c in report.checks if c.status.value == "fail"
        }
        for check in example["expected_checks_failed"]:
            assert check in failed_checks, (
                f"Expected check {check} to fail for {example['id']}"
            )

    # Assert expected trust band
    if "expected_trust_band" in example:
        assert trust_band.value == example["expected_trust_band"], (
            f"Expected trust band {example['expected_trust_band']}, "
            f"got {trust_band.value} for {example['id']}"
        )
