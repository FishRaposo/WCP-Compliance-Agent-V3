"""Davis-Bacon Wage Determination (DBWD) in-memory lookup.

Phase 1: Serves rates from a bundled JSON corpus (dbwd_corpus.json).
Phase 2+ will add a 3-tier cache-aside pattern:
  1. Redis cache (fast, TTL-based)
  2. PostgreSQL (persistent, queryable)
  3. SAM.gov API fallback (authoritative source)

The in-memory corpus is loaded lazily on first call and cached for the
lifetime of the process. Use reset_corpus_cache() in tests to force reload.
"""

from __future__ import annotations

import json
import re
import string
from datetime import date
from pathlib import Path

from wcp_backend.models.schemas import DBWDRateRecord

# Module-level cache for in-memory corpus
_IN_MEMORY_CORPUS: dict[str, DBWDRateRecord] | None = None

_IN_MEMORY_ALIASES: dict[str, str] = {
    "elec": "Electrician",
    "electrical": "Electrician",
    "electrical worker": "Electrician",
    "electricians": "Electrician",
    "plum": "Plumber",
    "plumb": "Plumber",
    "plumbing": "Plumber",
    "plumbers": "Plumber",
    "carp": "Carpenter",
    "carpentry": "Carpenter",
    "carpenters": "Carpenter",
    "labor": "Laborer",
    "general laborer": "Laborer",
    "common laborer": "Laborer",
    "helper": "Laborer",
    "operator": "Equipment Operator",
    "heavy equipment": "Equipment Operator",
    "equipment op": "Equipment Operator",
    "hoe operator": "Equipment Operator",
    "iron": "Ironworker",
    "structural ironworker": "Ironworker",
    "rebar": "Ironworker",
    "paint": "Painter",
    "painting": "Painter",
    "painters": "Painter",
    "sheet metal": "Sheet Metal Worker",
    "sheetmetal": "Sheet Metal Worker",
    "hvac sheet metal": "Sheet Metal Worker",
    "hvac": "HVAC Technician",
    "ac tech": "HVAC Technician",
    "refrigeration": "HVAC Technician",
    "weld": "Welder",
    "welding": "Welder",
    "certified welder": "Welder",
    "brick": "Mason",
    "bricklayer": "Mason",
    "stonemason": "Mason",
    "block layer": "Mason",
    "roof": "Roofer",
    "roofing": "Roofer",
    "shingler": "Roofer",
    "glass": "Glazier",
    "glazing": "Glazier",
    "insulation": "Insulation Worker",
    "insulator": "Insulation Worker",
    "tile": "Tile Setter",
    "ceramic tile": "Tile Setter",
    "mosaic": "Tile Setter",
    "drywall": "Drywall Installer",
    "gypsum": "Drywall Installer",
    "wallboard": "Drywall Installer",
    "concrete": "Concrete Finisher",
    "cement": "Concrete Finisher",
    "cement finisher": "Concrete Finisher",
    "survey": "Surveyor",
    "surveying": "Surveyor",
    "instrument man": "Surveyor",
    "flag": "Flagger",
    "traffic control": "Flagger",
    "driver": "Truck Driver",
    "dump truck": "Truck Driver",
    "truck": "Truck Driver",
}


def _load_corpus() -> dict[str, DBWDRateRecord]:
    """Load the in-memory DBWD corpus from bundled JSON file."""
    global _IN_MEMORY_CORPUS
    
    if _IN_MEMORY_CORPUS is not None:
        return _IN_MEMORY_CORPUS
    
    corpus_path = Path(__file__).parent.parent / "data" / "dbwd_corpus.json"
    
    try:
        with open(corpus_path) as f:
            data = json.load(f)
        
        _IN_MEMORY_CORPUS = {}
        for item in data:
            record = DBWDRateRecord(
                trade=item["trade"],
                locality=item["locality"],
                rate=item["rate"],
                fringe=item["fringe"],
                effective_date=date.fromisoformat(item["effective_date"]),
                wage_determination_number=item.get("wage_determination_number", "")
            )
            # Index by normalized trade name
            key = record.trade.lower().replace(" ", "_")
            _IN_MEMORY_CORPUS[key] = record
        
        return _IN_MEMORY_CORPUS
    except FileNotFoundError:
        # Return empty dict if corpus not found (shouldn't happen)
        _IN_MEMORY_CORPUS = {}
        return _IN_MEMORY_CORPUS


def _normalize_trade(trade: str) -> str:
    """Normalize trade name and aliases to the corpus key format."""
    normalized = trade.lower().strip()
    normalized = normalized.translate(str.maketrans("", "", string.punctuation))
    normalized = re.sub(r"\s+", " ", normalized)
    canonical = _IN_MEMORY_ALIASES.get(normalized, normalized)
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
        raise ValueError(f"Invalid effective date '{effective_date}'. Expected YYYY-MM-DD") from exc


def _matches_lookup(record: DBWDRateRecord, locality: str, lookup_date: date) -> bool:
    """Return true when a corpus record applies to the requested place/date."""
    return (
        _normalize_locality(record.locality) == _normalize_locality(locality)
        and record.effective_date <= lookup_date
    )


def _levenshtein_distance(a: str, b: str) -> int:
    """Calculate Levenshtein edit distance between two strings."""
    if len(a) < len(b):
        return _levenshtein_distance(b, a)
    
    if len(b) == 0:
        return len(a)
    
    previous_row = range(len(b) + 1)
    for i, c1 in enumerate(a):
        current_row = [i + 1]
        for j, c2 in enumerate(b):
            # Cost: 1 if characters differ, 0 if same
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
    
    return previous_row[-1]


def _fuzzy_match(trade: str, corpus: dict[str, DBWDRateRecord]) -> DBWDRateRecord | None:
    """Attempt fuzzy match if exact lookup fails."""
    normalized = _normalize_trade(trade)
    
    # Only attempt fuzzy match if trade name is at least 3 characters
    if len(normalized) < 3:
        return None
    
    best_match: tuple[str, int] | None = None
    
    for key in corpus.keys():
        distance = _levenshtein_distance(normalized, key)
        # Accept matches within 3 edit distance
        if distance <= 3:
            if best_match is None or distance < best_match[1]:
                best_match = (key, distance)
    
    if best_match:
        return corpus[best_match[0]]
    
    return None


async def get_dbwd_rate(trade: str, locality: str, effective_date: str) -> DBWDRateRecord:
    """
    Lookup DBWD rate from in-memory corpus (Phase 1).
    
    Phase 2 adds: Redis cache → PostgreSQL → SAM.gov fallback layers.
    """
    corpus = _load_corpus()
    normalized = _normalize_trade(trade)
    lookup_date = _parse_lookup_date(effective_date)
    scoped_corpus = {
        key: record
        for key, record in corpus.items()
        if _matches_lookup(record, locality, lookup_date)
    }

    if not scoped_corpus:
        raise ValueError(
            f"No DBWD rates found for locality '{locality}' on {effective_date}"
        )
    
    # Try exact match first
    if normalized in scoped_corpus:
        return scoped_corpus[normalized]
    
    # Try fuzzy match
    fuzzy_result = _fuzzy_match(trade, scoped_corpus)
    if fuzzy_result:
        return fuzzy_result
    
    # No match found - raise ValueError with helpful message
    available = sorted(set(r.trade for r in scoped_corpus.values()))
    raise ValueError(
        f"Trade '{trade}' not found in DBWD corpus. "
        f"Available trades: {', '.join(available)}"
    )


def reset_corpus_cache() -> None:
    """Reset the in-memory corpus cache. For test isolation only."""
    global _IN_MEMORY_CORPUS
    _IN_MEMORY_CORPUS = None


async def refresh_rates_from_sam_gov(trade: str, locality: str) -> list[DBWDRateRecord]:
    """
    Fetch latest rates from SAM.gov and upsert into PostgreSQL + Redis.
    
    Note: This is a stub for Phase 1. Full implementation in Phase 2+.
    """
    # Phase 1: Return empty list - SAM.gov integration is future work
    return []
