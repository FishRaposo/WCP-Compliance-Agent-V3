"""Prefect ETL — DBWD refresh flow (V4).

Purpose: Scheduled SAM.gov prevailing wage rate refresh with Great Expectations validation.

Flow steps:
1. Fetch latest DBWD rates from SAM.gov API
2. Validate with GE suite (dbwd_expectations.py)
3. Upsert validated rates into dbwd_rates table
4. Notify on failure

Responsibilities:
- Scheduled refresh on cron (default: daily)
- GE validation before commit
- Idempotent upserts (merge on rate_key)
"""

from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime
from typing import Any

import httpx
from sqlalchemy import text

from wcp_backend.config import settings
from wcp_backend.pipelines.utils import prefect_flow, prefect_task
from wcp_backend.quality.dbwd_expectations import validate_dbwd_rates
from wcp_backend.services.db import async_session

__all__ = ["dbwd_refresh_flow"]

_logger = logging.getLogger(__name__)

_SAM_GOV_BASE = "https://api.sam.gov/wages/v2/wage-determinations"
_MAX_RETRIES = 3
_REQUEST_TIMEOUT = 30
_MAX_RECORDS = 1000
_PAGE_SIZE = 100


@prefect_task(retries=3, retry_delay_seconds=60)
async def fetch_sam_gov_rates(sam_gov_api_key: str | None = None) -> list[dict[str, Any]]:
    """Fetch DBWD rates from SAM.gov WAGE API with pagination and retry.

    Args:
        sam_gov_api_key: SAM.gov API key. Falls back to settings.sam_gov_api_key.

    Returns:
        List of rate dicts with keys: trade, locality, rate, fringe,
        effective_date, wage_determination_number.
    """
    api_key = sam_gov_api_key or settings.sam_gov_api_key
    if not api_key:
        _logger.warning("SAM_GOV_API_KEY not configured — returning empty rate list")
        return []

    all_rates: list[dict[str, Any]] = []
    offset = 0

    async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT) as client:
        while len(all_rates) < _MAX_RECORDS:
            params: dict[str, str | int] = {
                "api_key": api_key,
                "limit": _PAGE_SIZE,
                "offset": offset,
            }

            body = await _fetch_with_retry(client, params)
            if body is None:
                break

            items = body.get("items", body.get("data", []))
            if not isinstance(items, list) or not items:
                break

            for item in items:
                parsed = _parse_rate_item(item)
                if parsed is not None:
                    all_rates.append(parsed)

            if len(items) < _PAGE_SIZE:
                break
            offset += _PAGE_SIZE

    _logger.info("Fetched %d DBWD rates from SAM.gov", len(all_rates))
    return all_rates


async def _fetch_with_retry(
    client: httpx.AsyncClient,
    params: dict[str, str | int],
) -> dict[str, Any] | None:
    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            response = await client.get(_SAM_GOV_BASE, params=params)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as exc:
            _logger.warning(
                "SAM.gov HTTP %s (attempt %d/%d)",
                exc.response.status_code,
                attempt,
                _MAX_RETRIES,
            )
            if attempt == _MAX_RETRIES:
                return None
        except httpx.RequestError as exc:
            _logger.warning(
                "SAM.gov request error (attempt %d/%d): %s",
                attempt,
                _MAX_RETRIES,
                exc,
            )
            if attempt == _MAX_RETRIES:
                return None
        await asyncio.sleep(2 ** attempt)
    return None


def _parse_rate_item(item: dict[str, Any]) -> dict[str, Any] | None:
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
            "trade": item.get("trade", ""),
            "locality": item.get("locality", ""),
            "rate": rate,
            "fringe": fringe,
            "effective_date": parsed_date,
            "wage_determination_number": str(wd_number),
        }
    except (ValueError, TypeError, KeyError) as exc:
        _logger.warning("Skipping invalid rate item: %s", exc)
        return None


@prefect_task()
async def validate_rates(rates: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    result = validate_dbwd_rates(rates)
    if result.success:
        return rates, []
    failed_rows = {int(error["row"]) for error in result.errors if "row" in error}
    valid = [rate for index, rate in enumerate(rates, start=1) if index not in failed_rows]
    failed = [
        {"record": rates[index - 1], "errors": error.get("errors", [])}
        for index in failed_rows
        for error in result.errors
        if error.get("row") == index
    ]
    return valid, failed


@prefect_task(retries=2, retry_delay_seconds=30)
async def upsert_rates(valid_rates: list[dict[str, Any]]) -> int:
    if not valid_rates:
        return 0
    async with async_session() as session:
        count = 0
        for rate in valid_rates:
            effective_date = rate.get("effective_date") or date.today().isoformat()
            await session.execute(
                text(
                    """
                    INSERT INTO dbwd_rates
                        (trade, locality, rate, fringe, effective_date, wage_determination_number)
                    VALUES
                        (:trade, :locality, :rate, :fringe, :effective_date, :wd_number)
                    ON CONFLICT (trade, locality, effective_date)
                    DO UPDATE SET
                        rate = EXCLUDED.rate,
                        fringe = EXCLUDED.fringe,
                        wage_determination_number = EXCLUDED.wage_determination_number
                    """
                ),
                {
                    "trade": rate.get("trade") or rate.get("trade_code"),
                    "locality": rate.get("locality") or rate.get("locality_code"),
                    "rate": float(rate.get("rate", rate.get("wage", 0))),
                    "fringe": float(rate.get("fringe", 0)),
                    "effective_date": effective_date,
                    "wd_number": rate.get("wage_determination_number") or rate.get("wd_number") or "unknown",
                },
            )
            count += 1
        await session.commit()
        return count


@prefect_flow(name="dbwd-rate-refresh", description="Refresh DBWD rates with validation")
async def dbwd_refresh_flow(
    sam_gov_api_key: str | None = None,
    rates: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Execute the DBWD refresh ETL flow.

    Args:
        sam_gov_api_key: SAM.gov API key. Falls back to environment variable.

    Returns:
        Dict with flow run results: status, records_fetched, records_validated,
        records_updated, errors.
    """
    fetched = rates if rates is not None else await fetch_sam_gov_rates(sam_gov_api_key)
    valid, failed = await validate_rates(fetched)
    updated = await upsert_rates(valid)
    return {
        "status": "success" if not failed else "partial",
        "records_fetched": len(fetched),
        "records_validated": len(valid),
        "records_updated": updated,
        "errors": failed,
    }
