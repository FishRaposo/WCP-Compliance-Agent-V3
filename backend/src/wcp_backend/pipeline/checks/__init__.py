"""Pipeline checks package."""

from __future__ import annotations

__all__ = ["_slugify"]


def _slugify(name: str) -> str:
    """Convert name to slug for check_id."""
    return name.lower().replace(" ", "_").replace("-", "_")
