"""SAM.gov ETL pipeline — fetch live DBWD rates and upsert into PostgreSQL."""

from __future__ import annotations

import asyncio

import httpx

from wcp_backend.config import settings

SAM_GOV_BASE = "https://api.sam.gov/wages/v2"


async def fetch_rates(trade: str, locality: str) -> list[dict]:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SAM_GOV_BASE}/wage-determinations",
            params={"trade": trade, "locality": locality},
            headers={"X-Api-Key": settings.sam_gov_api_key},
        )
        response.raise_for_status()
        return response.json().get("items", [])


async def run_etl(trades: list[str], localities: list[str]) -> None:
    # TODO: implement — fetch → validate → upsert DBWD rates
    raise NotImplementedError


if __name__ == "__main__":
    asyncio.run(run_etl(trades=["Electrician", "Plumber"], localities=["Washington, DC"]))
