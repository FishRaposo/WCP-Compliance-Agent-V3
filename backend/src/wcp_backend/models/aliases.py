"""Canonical trade aliases used across extraction and DBWD lookup."""

from __future__ import annotations

IN_MEMORY_ALIASES: dict[str, str] = {
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


def resolve_classification(raw_classification: str) -> str:
    """Normalize trade classification using aliases."""
    normalized = raw_classification.strip().lower()
    if normalized in IN_MEMORY_ALIASES:
        return IN_MEMORY_ALIASES[normalized]
    for canonical in set(IN_MEMORY_ALIASES.values()):
        if normalized == canonical.lower():
            return canonical
    return raw_classification.strip()
