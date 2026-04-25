"""Generate Pydantic models (Python) and Zod schemas (TypeScript) from shared JSON Schemas."""

from __future__ import annotations

import json
from pathlib import Path

SCHEMAS_DIR = Path(__file__).parent / "schemas"
BACKEND_OUT = Path(__file__).parent.parent / "backend/src/wcp_backend/models"
AGENT_OUT = Path(__file__).parent.parent / "agent/src/types"


def load_schemas() -> dict[str, dict]:
    schemas = {}
    for path in SCHEMAS_DIR.glob("*.json"):
        schemas[path.stem] = json.loads(path.read_text())
    return schemas


def generate_pydantic(schema: dict) -> str:
    # TODO: implement JSON Schema → Pydantic v2 model generation
    raise NotImplementedError


def generate_zod(schema: dict) -> str:
    # TODO: implement JSON Schema → Zod schema generation
    raise NotImplementedError


if __name__ == "__main__":
    schemas = load_schemas()
    print(f"Found {len(schemas)} schemas: {list(schemas.keys())}")
    # TODO: generate and write output files
