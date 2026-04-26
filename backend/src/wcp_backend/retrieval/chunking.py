"""Domain-aware chunking for DBWD regulation text (trade x locality)."""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass
class RegulationChunk:
    chunk_id: str
    text: str
    trade: str
    locality: str
    regulation_cite: str
    wage_determination_number: str = ""


def _split_sentences(text: str) -> list[str]:
    """Split text into sentences, preserving abbreviations."""
    # Simple regex: split on period followed by space and capital letter,
    # or period at end of string. This is a heuristic.
    pattern = r'(?<=[.!?])\s+(?=[A-Z])|(?<=[.!?])\s*$'
    sentences = re.split(pattern, text.strip())
    return [s.strip() for s in sentences if s.strip()]


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
    Preserves trade x locality metadata for filtering in retrieval.

    Uses sentence-aware sliding window: chunks are built from sentences
    and truncated at chunk_size characters, with overlap sentences
    carried into the next chunk.
    """
    sentences = _split_sentences(text)
    if not sentences:
        return []

    chunks: list[RegulationChunk] = []
    chunk_index = 0
    i = 0

    while i < len(sentences):
        current_sentences: list[str] = []
        current_len = 0

        # Add sentences until we hit chunk_size
        while i < len(sentences):
            sent = sentences[i]
            # +1 for space between sentences
            projected_len = current_len + len(sent) + (1 if current_len > 0 else 0)
            if projected_len > chunk_size and current_sentences:
                break
            current_sentences.append(sent)
            current_len = projected_len
            i += 1

        chunk_text = " ".join(current_sentences)
        chunk_id = (
            f"{trade.lower().replace(' ', '_')}_"
            f"{locality.lower().replace(' ', '_').replace(',', '')}_"
            f"{regulation_cite.lower().replace(' ', '_').replace('.', '')}_"
            f"{chunk_index:03d}"
        )

        chunks.append(
            RegulationChunk(
                chunk_id=chunk_id,
                text=chunk_text,
                trade=trade,
                locality=locality,
                regulation_cite=regulation_cite,
            )
        )
        chunk_index += 1

        # Back up by overlap sentences for the next chunk
        if overlap > 0 and current_sentences:
            overlap_sentences: list[str] = []
            overlap_len = 0
            for sent in reversed(current_sentences):
                projected = overlap_len + len(sent) + (1 if overlap_len > 0 else 0)
                if projected > overlap and overlap_sentences:
                    break
                overlap_sentences.insert(0, sent)
                overlap_len = projected

            # Move index back to start of overlap
            i -= len(current_sentences) - len(overlap_sentences)
            if i < 0:
                i = 0

    return chunks
