"""Index DBWD regulation chunks into Elasticsearch for BM25 retrieval."""

from __future__ import annotations

import asyncio


async def seed() -> None:
    # TODO: implement — read DBWD text, chunk, index into ES
    raise NotImplementedError


if __name__ == "__main__":
    asyncio.run(seed())
