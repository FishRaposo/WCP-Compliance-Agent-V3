"""SAM.gov ETL pipeline — fetch live DBWD rates and upsert into PostgreSQL.

Usage:
    poetry run python scripts/etl_sam_gov.py

Requires SAM_GOV_API_KEY to be set in the environment or backend/.env.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import date, datetime

import httpx
from sqlalchemy import Table, Column, MetaData, Text, Float, Date, DateTime, sql
from sqlalchemy.dialects.postgresql import UUID as PgUUID, insert as pg_insert
from sqlalchemy.ext.asyncio import create_async_engine

from wcp_backend.config import settings
from wcp_backend.models.aliases import IN_MEMORY_ALIASES

logger = logging.getLogger(__name__)

SAM_GOV_BASE = "https://api.sam.gov/wages/v2/wage-determinations"
DEFAULT_LOCALITIES = ["Washington, DC"]
DEFAULT_TRADES = list(dict.fromkeys(IN_MEMORY_ALIASES.values()))
MAX_RETRIES = 3
REQUEST_TIMEOUT = 30


def _build_table() -> Table:
    metadata = MetaData()
    return Table(
        "dbwd_rates",
        metadata,
        Column("id", PgUUID(), primary_key=True, server_default=sql.text("gen_random_uuid()")),
        Column("trade", Text(), nullable=False),
        Column("locality", Text(), nullable=False),
        Column("rate", Float(), nullable=False),
        Column("fringe", Float(), nullable=False, server_default="0"),
        Column("effective_date", Date(), nullable=False),
        Column("wage_determination_number", Text(), nullable=False),
        Column("created_at", DateTime(timezone=True), nullable=False, server_default=sql.text("NOW()")),
    )


async def fetch_rates(
    client: httpx.AsyncClient,
    trade: str,
    locality: str,
) -> list[dict]:
    """Fetch wage determination rates from SAM.gov for a trade + locality."""
    params: dict[str, str | int] = {
        "trade": trade,
        "locality": locality,
        "api_key": settings.sam_gov_api_key,
    }

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = await client.get(SAM_GOV_BASE, params=params)
            response.raise_for_status()
            body = response.json()
            items = body.get("items", body.get("data", []))
            if isinstance(items, list):
                return items
            logger.warning("Unexpected SAM.gov response shape for %s/%s", trade, locality)
            return []
        except httpx.HTTPStatusError as exc:
            logger.warning(
                "SAM.gov HTTP %s for %s/%s (attempt %d/%d)",
                exc.response.status_code,
                trade,
                locality,
                attempt,
                MAX_RETRIES,
            )
            if attempt == MAX_RETRIES:
                return []
        except httpx.RequestError as exc:
            logger.warning(
                "SAM.gov request error for %s/%s (attempt %d/%d): %s",
                trade,
                locality,
                attempt,
                MAX_RETRIES,
                exc,
            )
            if attempt == MAX_RETRIES:
                return []
        await asyncio.sleep(2**attempt)

    return []


def _parse_rate_item(item: dict, trade: str, locality: str) -> dict | None:
    """Parse a single SAM.gov rate item into a dbwd_rates-compatible dict."""
    try:
        rate_val = item.get("rate")
        fringe_val = item.get("fringe", 0)
        effective = item.get("effectiveDate", item.get("effective_date"))
        wd_number = item.get("wdNumber", item.get("wage_determination_number", ""))

        if rate_val is None:
            return None

        rate = float(rate_val)
        fringe = float(fringe_val) if fringe_val else 0.0

        if effective:
            if isinstance(effective, str):
                parsed_date = date.fromisoformat(effective[:10])
            elif isinstance(effective, (int, float)):
                parsed_date = date.fromisoformat(
                    datetime.fromtimestamp(effective / 1000).strftime("%Y-%m-%d")
                )
            else:
                parsed_date = date.today()
        else:
            parsed_date = date.today()

        return {
            "trade": item.get("trade", trade),
            "locality": item.get("locality", locality),
            "rate": rate,
            "fringe": fringe,
            "effective_date": parsed_date,
            "wage_determination_number": str(wd_number),
        }
    except (ValueError, TypeError, KeyError) as exc:
        logger.warning("Skipping invalid rate item: %s", exc)
        return None


async def upsert_rates(engine: create_async_engine, records: list[dict]) -> int:
    """Upsert validated rate records into the dbwd_rates table."""
    if not records:
        return 0

    dbwd_rates = _build_table()
    upserted = 0

    async with engine.connect() as conn:
        for record in records:
            stmt = pg_insert(dbwd_rates).values(**record).on_conflict_do_update(
                index_elements=["trade", "locality", "effective_date"],
                set_={
                    "rate": record["rate"],
                    "fringe": record["fringe"],
                    "wage_determination_number": record["wage_determination_number"],
                },
            )
            await conn.execute(stmt)
            upserted += 1

        await conn.commit()

    return upserted


async def run_etl(
    trades: list[str] | None = None,
    localities: list[str] | None = None,
) -> dict[str, int]:
    """Full ETL pipeline: fetch from SAM.gov → validate → upsert into PostgreSQL.

    Returns a dict with counts: {"fetched": N, "validated": N, "upserted": N, "skipped": N}
    """
    if not settings.sam_gov_api_key:
        logger.error("SAM_GOV_API_KEY is not set. Cannot fetch live rates.")
        print("Error: SAM_GOV_API_KEY is required. Set it in backend/.env or environment.")
        return {"fetched": 0, "validated": 0, "upserted": 0, "skipped": 0}

    trades = trades or DEFAULT_TRADES
    localities = localities or DEFAULT_LOCALITIES

    logger.info("Starting SAM.gov ETL: %d trades × %d localities", len(trades), len(localities))

    engine = create_async_engine(settings.database_url)
    all_records: list[dict] = []
    fetched_count = 0

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        for trade in trades:
            for locality in localities:
                items = await fetch_rates(client, trade, locality)
                fetched_count += len(items)

                for item in items:
                    parsed = _parse_rate_item(item, trade, locality)
                    if parsed is not None:
                        all_records.append(parsed)

    validated_count = len(all_records)
    skipped_count = fetched_count - validated_count

    logger.info(
        "Fetched %d items, validated %d, skipped %d",
        fetched_count,
        validated_count,
        skipped_count,
    )

    upserted_count = await upsert_rates(engine, all_records)
    await engine.dispose()

    result = {
        "fetched": fetched_count,
        "validated": validated_count,
        "upserted": upserted_count,
        "skipped": skipped_count,
    }

    logger.info("ETL complete: %s", result)
    print(f"ETL results: {json.dumps(result, indent=2)}")
    return result


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    asyncio.run(run_etl())
