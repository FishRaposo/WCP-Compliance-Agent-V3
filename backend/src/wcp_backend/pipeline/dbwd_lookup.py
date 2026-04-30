"""Davis-Bacon Wage Determination (DBWD) lookup with 3-tier cache.

Tier 1: Redis cache (fast, TTL-based)
Tier 2: PostgreSQL dbwd_rates table (persistent, queryable)
Tier 3: In-memory corpus (Phase 1 fallback)
Tier 4: SAM.gov API (future — stub for now)
"""

from __future__ import annotations

import re
import string
from datetime import date
from functools import lru_cache
from pathlib import Path

from sqlalchemy import text

from wcp_backend.models.aliases import IN_MEMORY_ALIASES
from wcp_backend.models.schemas import DBWDRateRecord
from wcp_backend.observability.tracing import trace_span
from wcp_backend.services.db import engine
from wcp_backend.services.redis_cache import cache_get, cache_set, dbwd_cache_key

# Module-level cache for in-memory corpus
_IN_MEMORY_CORPUS: dict[str, DBWDRateRecord] | None = None


def _load_corpus() -> dict[str, DBWDRateRecord]:
    """Load the in-memory DBWD corpus from bundled JSON file."""
    global _IN_MEMORY_CORPUS

    if _IN_MEMORY_CORPUS is not None:
        return _IN_MEMORY_CORPUS

    corpus_path = Path(__file__).parent.parent / "data" / "dbwd_corpus.json"

    try:
        import json as _json

        with open(corpus_path) as f:
            data = _json.load(f)

        _IN_MEMORY_CORPUS = {}
        for item in data:
            record = DBWDRateRecord(
                trade=item["trade"],
                locality=item["locality"],
                rate=item["rate"],
                fringe=item["fringe"],
                effective_date=date.fromisoformat(item["effective_date"]),
                wage_determination_number=item.get("wage_determination_number", ""),
            )
            key = record.trade.lower().replace(" ", "_")
            _IN_MEMORY_CORPUS[key] = record

        return _IN_MEMORY_CORPUS
    except FileNotFoundError:
        _IN_MEMORY_CORPUS = {}
        return _IN_MEMORY_CORPUS


def _normalize_trade(trade: str) -> str:
    """Normalize trade name and aliases to the corpus key format."""
    normalized = trade.lower().strip()
    normalized = normalized.translate(str.maketrans("", "", string.punctuation))
    normalized = re.sub(r"\s+", " ", normalized)
    canonical = IN_MEMORY_ALIASES.get(normalized, normalized)
    return canonical.lower().strip().replace(" ", "_")


def _normalize_locality(locality: str) -> str:
    """Normalize locality names for Phase 1 corpus matching."""
    normalized = locality.lower().strip()
    normalized = normalized.translate(str.maketrans("", "", string.punctuation))
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized


def _parse_lookup_date(effective_date: str) -> date:
    """Parse the requested DBWD lookup date."""
    try:
        return date.fromisoformat(effective_date)
    except ValueError as exc:
        raise ValueError(
            f"Invalid effective date '{effective_date}'. Expected YYYY-MM-DD"
        ) from exc


def _matches_lookup(record: DBWDRateRecord, locality: str, lookup_date: date) -> bool:
    """Return true when a corpus record applies to the requested place/date."""
    return (
        _normalize_locality(record.locality) == _normalize_locality(locality)
        and record.effective_date <= lookup_date
    )


@lru_cache(maxsize=1024)
def _levenshtein_distance(a: str, b: str) -> int:
    """Calculate Levenshtein edit distance between two strings."""
    if len(a) < len(b):
        return _levenshtein_distance(b, a)

    if len(b) == 0:
        return len(a)

    previous_row: list[int] = list(range(len(b) + 1))
    for i, c1 in enumerate(a):
        current_row = [i + 1]
        for j, c2 in enumerate(b):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row

    return previous_row[-1]


def _fuzzy_match(trade: str, corpus: dict[str, DBWDRateRecord]) -> DBWDRateRecord | None:
    """Attempt fuzzy match if exact lookup fails."""
    normalized = _normalize_trade(trade)

    if len(normalized) < 3:
        return None

    best_match: tuple[str, int] | None = None

    for key in corpus.keys():
        distance = _levenshtein_distance(normalized, key)
        if distance <= 3:
            if best_match is None or distance < best_match[1]:
                best_match = (key, distance)

    if best_match:
        return corpus[best_match[0]]

    return None


async def _lookup_in_postgres(
    trade: str, locality: str, effective_date: str
) -> DBWDRateRecord | None:
    """Query PostgreSQL dbwd_rates table for a matching rate."""
    lookup_date = _parse_lookup_date(effective_date)

    # Try exact canonical trade name first, then fallback to raw trade
    candidates = [trade, IN_MEMORY_ALIASES.get(trade.lower().strip(), trade)]

    async with engine.connect() as conn:
        for candidate_trade in candidates:
            result = await conn.execute(
                text("""
                    SELECT trade, locality, rate, fringe, effective_date, wage_determination_number
                    FROM dbwd_rates
                    WHERE trade ILIKE :trade
                      AND locality ILIKE :locality
                      AND effective_date <= :effective_date
                    ORDER BY effective_date DESC
                    LIMIT 1
                """),
                {
                    "trade": candidate_trade,
                    "locality": locality,
                    "effective_date": lookup_date.isoformat(),
                },
            )
            row = result.fetchone()
            if row:
                return DBWDRateRecord(
                    trade=row.trade,
                    locality=row.locality,
                    rate=row.rate,
                    fringe=row.fringe,
                    effective_date=row.effective_date,
                    wage_determination_number=row.wage_determination_number or "",
                )
    return None


def _lookup_in_memory(trade: str, locality: str, lookup_date: date) -> DBWDRateRecord:
    """Fallback to in-memory corpus."""
    corpus = _load_corpus()
    normalized = _normalize_trade(trade)
    scoped_corpus = {
        key: record
        for key, record in corpus.items()
        if _matches_lookup(record, locality, lookup_date)
    }

    if not scoped_corpus:
        raise ValueError(
            f"No DBWD rates found for locality '{locality}' on {lookup_date.isoformat()}"
        )

    if normalized in scoped_corpus:
        return scoped_corpus[normalized]

    fuzzy_result = _fuzzy_match(trade, scoped_corpus)
    if fuzzy_result:
        return fuzzy_result

    available = sorted(set(r.trade for r in scoped_corpus.values()))
    raise ValueError(
        f"Trade '{trade}' not found in DBWD corpus. "
        f"Available trades: {', '.join(available)}"
    )


@trace_span("get_dbwd_rate", attributes={"component": "dbwd_lookup"})
async def get_dbwd_rate(trade: str, locality: str, effective_date: str) -> DBWDRateRecord:
    """
    3-tier DBWD rate lookup:
    1. Redis cache (fast, TTL-based)
    2. PostgreSQL dbwd_rates table (persistent)
    3. In-memory corpus (fallback)
    """
    cache_key = dbwd_cache_key(trade, locality, effective_date)

    # Tier 1: Redis
    try:
        cached = await cache_get(cache_key)
        if cached:
            try:
                return DBWDRateRecord.model_validate(cached)
            except Exception:
                # Cache hit but invalid data — fall through
                pass
    except Exception:
        # Redis unavailable — fall through to next tier
        pass

    # Tier 2: PostgreSQL
    try:
        db_rate = await _lookup_in_postgres(trade, locality, effective_date)
        if db_rate:
            try:
                await cache_set(cache_key, db_rate.model_dump(mode="json"))
            except Exception:
                # Non-fatal: cache write failure should not block returning the rate
                pass
            return db_rate
    except Exception:
        # PostgreSQL unavailable — fall through to next tier
        pass

    # Tier 3: In-memory corpus
    lookup_date = _parse_lookup_date(effective_date)
    mem_rate = _lookup_in_memory(trade, locality, lookup_date)
    try:
        await cache_set(cache_key, mem_rate.model_dump(mode="json"))
    except Exception:
        pass
    return mem_rate


def reset_corpus_cache() -> None:
    """Reset the in-memory corpus cache. For test isolation only."""
    global _IN_MEMORY_CORPUS
    _IN_MEMORY_CORPUS = None


async def refresh_rates_from_sam_gov(trade: str, locality: str) -> list[DBWDRateRecord]:
    """
    Fetch latest rates from SAM.gov and upsert into PostgreSQL + Redis.

    Note: Use `backend/scripts/etl_sam_gov.py` to refresh rates from SAM.gov.
    """
    return []
