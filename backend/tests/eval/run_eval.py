"""Golden set evaluation runner — pytest-benchmark integration."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

GOLDEN_SET_PATH = Path(__file__).parent / "golden_set.json"


def load_golden_set() -> list[dict]:
    return json.loads(GOLDEN_SET_PATH.read_text())


@pytest.mark.eval
@pytest.mark.parametrize("example", load_golden_set(), ids=lambda e: e["id"])
def test_golden_example(example: dict, benchmark) -> None:
    """Run each golden set example through the full pipeline and assert expected outcome."""
    # TODO: implement — call backend pipeline, assert verdict + trust_score
    pytest.skip("Not implemented yet")
