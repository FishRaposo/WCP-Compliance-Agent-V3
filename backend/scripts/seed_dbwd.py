"""Seed initial DBWD rates into PostgreSQL from a JSON fixture."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path


FIXTURE_PATH = Path(__file__).parent.parent / "tests/eval/golden_set.json"


async def seed() -> None:
    # TODO: implement — connect to DB, insert DBWD rates from fixture or SAM.gov
    raise NotImplementedError


if __name__ == "__main__":
    asyncio.run(seed())
