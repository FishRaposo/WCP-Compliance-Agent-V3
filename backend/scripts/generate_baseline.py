"""Generate baseline_scores.json from the golden set.

Runs each golden set example through the deterministic pipeline
and records the trust score. This baseline is used by regression_test.py
to detect trust score drift.

Usage:
    cd backend
    poetry run python scripts/generate_baseline.py
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

GOLDEN_SET_PATH = Path(__file__).parent.parent / "tests" / "eval" / "golden_set.json"
BASELINE_PATH = Path(__file__).parent.parent / "tests" / "eval" / "baseline_scores.json"
EVAL_REPORT_PATH = Path(__file__).parent.parent / "eval_report.json"


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


async def main() -> None:
    from wcp_backend.pipeline.extraction import extract_from_text
    from wcp_backend.pipeline.rules import run_rule_engine

    golden_set = json.loads(GOLDEN_SET_PATH.read_text())
    deterministic_scores: dict[str, float] = {}

    for example in golden_set:
        eid = example["id"]
        text = _build_wh347_text(example)
        extracted = extract_from_text(text)
        report = await run_rule_engine(extracted)
        trust_score = 1.0 - (
            report.violation_count / max(len(report.checks), 1)
        )
        deterministic_scores[eid] = round(trust_score, 4)

    baseline = {"deterministic": deterministic_scores, "llm": {}}

    # Write both baseline and eval_report (they start identical)
    BASELINE_PATH.write_text(json.dumps(baseline, indent=2))
    EVAL_REPORT_PATH.write_text(json.dumps(baseline, indent=2))

    print(f"Generated {BASELINE_PATH} with {len(deterministic_scores)} examples")
    print(f"Generated {EVAL_REPORT_PATH}")


if __name__ == "__main__":
    asyncio.run(main())
