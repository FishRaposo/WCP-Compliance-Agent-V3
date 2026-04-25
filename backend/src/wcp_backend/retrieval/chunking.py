"""Domain-aware chunking for DBWD regulation text (trade × locality)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class RegulationChunk:
    chunk_id: str
    text: str
    trade: str
    locality: str
    regulation_cite: str
    wage_determination_number: str = ""


def chunk_regulation_text(
    text: str,
    trade: str,
    locality: str,
    regulation_cite: str,
    chunk_size: int = 512,
    overlap: int = 64,
) -> list[RegulationChunk]:
    """
    Split regulation text into overlapping chunks.
    Preserves trade × locality metadata for filtering in retrieval.
    """
    # TODO: implement sliding-window chunking with sentence boundary awareness
    raise NotImplementedError
