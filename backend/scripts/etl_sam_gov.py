"""SAM.gov ETL pipeline — fetch live DBWD rates and upsert into PostgreSQL."""

from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime
from typing import Any

import httpx
from sqlalchemy import Column, Date, DateTime, Float, MetaData, Table, Text, sql
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from wcp_backend.config import settings

logger = logging.getLogger(__name__)

SAM_GOV_BASE = "https://api.sam.gov/wages/v2"


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


async def fetch_rates(client: httpx.AsyncClient, trade: str, locality: str) -> list[dict[str, Any]]:
    response = await client.get(
        f"{SAM_GOV_BASE}/wage-determinations",
        params={"trade": trade, "locality": locality},
        headers={"X-Api-Key": settings.sam_gov_api_key},
    )
    response.raise_for_status()
    body = response.json()
    items = body.get("items", body.get("data", []))
    if isinstance(items, list):
        return items
    return []


def _parse_rate_item(item: dict[str, Any], trade: str, locality: str) -> dict[str, Any] | None:
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


async def upsert_rates(engine: AsyncEngine, records: list[dict[str, Any]]) -> int:
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


async def run_etl(trades: list[str], localities: list[str]) -> dict[str, int]:
    if not settings.sam_gov_api_key:
        logger.error("SAM_GOV_API_KEY is not set.")
        return {"fetched": 0, "validated": 0, "upserted": 0, "skipped": 0}

    engine = create_async_engine(settings.database_url)
    all_records: list[dict[str, Any]] = []
    fetched_count = 0

    async with httpx.AsyncClient() as client:
        for trade in trades:
            for locality in localities:
                try:
                    items = await fetch_rates(client, trade, locality)
                    fetched_count += len(items)

                    for item in items:
                        parsed = _parse_rate_item(item, trade, locality)
                        if parsed is not None:
                            all_records.append(parsed)
                except httpx.HTTPError as exc:
                    logger.warning("Failed to fetch rates for %s in %s: %s", trade, locality, exc)

    validated_count = len(all_records)
    skipped_count = fetched_count - validated_count

    upserted_count = await upsert_rates(engine, all_records)
    await engine.dispose()

    result = {
        "fetched": fetched_count,
        "validated": validated_count,
        "upserted": upserted_count,
        "skipped": skipped_count,
    }
    logger.info("ETL complete: %s", result)
    return result


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_etl(trades=["Electrician", "Plumber"], localities=["Washington, DC"]))
