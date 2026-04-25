"""Generate sentence-transformer embeddings for regulation chunks and store in pgvector."""

from __future__ import annotations

import asyncio


async def seed() -> None:
    # TODO: implement — load chunks from ES, embed with sentence-transformers, upsert into pgvector
    raise NotImplementedError


if __name__ == "__main__":
    asyncio.run(seed())
