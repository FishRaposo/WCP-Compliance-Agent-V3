"""CI hard-fail regression check — compares current eval scores against baseline.

Fails if trust score drops > 0.05 on any golden set example vs. stored baseline.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

BASELINE_PATH = Path(__file__).parent / "baseline_scores.json"
RESULTS_PATH = Path(__file__).parent.parent.parent / "eval_report.json"
TRUST_SCORE_REGRESSION_THRESHOLD = 0.05


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text())


def check_regression() -> None:
    baseline = load_json(BASELINE_PATH)
    results = load_json(RESULTS_PATH)

    failures = []
    for example_id, current_score in results.items():
        if example_id not in baseline:
            continue
        baseline_score = baseline[example_id]
        if baseline_score - current_score > TRUST_SCORE_REGRESSION_THRESHOLD:
            failures.append(
                f"{example_id}: trust score dropped {baseline_score:.3f} → {current_score:.3f}"
                f" (threshold: {TRUST_SCORE_REGRESSION_THRESHOLD})"
            )

    if failures:
        print("REGRESSION DETECTED:")
        for f in failures:
            print(f"  {f}")
        sys.exit(1)

    print(f"No regression detected across {len(results)} examples.")


if __name__ == "__main__":
    check_regression()
