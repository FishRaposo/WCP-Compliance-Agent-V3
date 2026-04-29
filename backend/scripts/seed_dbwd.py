"""Seed DBWD rates into PostgreSQL from the bundled corpus."""

from __future__ import annotations

import asyncio
import json
from datetime import date
from pathlib import Path

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import create_async_engine

from wcp_backend.config import settings

# Paths
CORPUS_PATH = Path(__file__).parent.parent / "src/wcp_backend/data/dbwd_corpus.json"
_SEEDED_MESSAGE = "Seeded {0} DBWD rate records"


async def seed() -> int:
    """Seed DBWD rates from corpus into PostgreSQL dbwd_rates table.
    
    Returns:
        Number of records inserted.
    """
    # Load corpus
    with open(CORPUS_PATH) as f:
        data = json.load(f)
    
    # Create async engine
    engine = create_async_engine(settings.database_url)
    
    # Import table metadata
    from sqlalchemy import Table, Column, MetaData, Text, Float, Date, DateTime
    from sqlalchemy.dialects.postgresql import UUID as PgUUID
    from sqlalchemy import sql
    
    metadata = MetaData()
    
    # Define dbwd_rates table structure (matching migration 004)
    dbwd_rates = Table(
        'dbwd_rates',
        metadata,
        Column('id', PgUUID(), primary_key=True, server_default=sql.text('gen_random_uuid()')),
        Column('trade', Text(), nullable=False),
        Column('locality', Text(), nullable=False),
        Column('rate', Float(), nullable=False),
        Column('fringe', Float(), nullable=False, server_default='0'),
        Column('effective_date', Date(), nullable=False),
        Column('wage_determination_number', Text(), nullable=False),
        Column('created_at', DateTime(timezone=True), nullable=False, server_default=sql.text('NOW()')),
    )
    
    inserted = 0
    async with engine.connect() as conn:
        for item in data:
            try:
                stmt = insert(dbwd_rates).values(
                    trade=item["trade"],
                    locality=item["locality"],
                    rate=item["rate"],
                    fringe=item["fringe"],
                    effective_date=date.fromisoformat(item["effective_date"]),
                    wage_determination_number=item.get("wage_determination_number", ""),
                ).on_conflict_do_nothing(
                    index_elements=['trade', 'locality', 'effective_date']
                )
                await conn.execute(stmt)
                inserted += 1
            except Exception as e:
                print(f"Warning: Could not insert {item.get('trade')}: {e}")  # noqa: T201
                # Non-fatal: continue seeding other records
        
        await conn.commit()
    
    await engine.dispose()
    print(f"Seeded {inserted} DBWD rate records")
    return inserted


if __name__ == "__main__":
    asyncio.run(seed())
