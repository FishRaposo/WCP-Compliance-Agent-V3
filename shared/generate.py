"""
Shared schema codegen — generates Pydantic v2 models and Zod schemas from JSON Schema.

Usage:
    python shared/generate.py

This reads shared/schemas/*.json and writes:
    - backend/src/wcp_backend/models/_generated.py  (Pydantic v2)
    - agent/src/types/_generated.ts  (Zod schemas)

TODO: Run this script whenever shared/schemas/*.json changes.
"""

from __future__ import annotations

import json
from pathlib import Path

SCHEMAS_DIR = Path(__file__).parent / "schemas"
BACKEND_OUTPUT = Path(__file__).parent.parent / "backend" / "src" / "wcp_backend" / "models" / "_generated.py"
AGENT_OUTPUT = Path(__file__).parent.parent / "agent" / "src" / "types" / "_generated.ts"


def _json_type_to_pydantic(js_type: str, enum: list | None = None) -> str:
    mapping = {
        "string": "str",
        "integer": "int",
        "number": "float",
        "boolean": "bool",
        "array": "list[Any]",
        "object": "dict[str, Any]",
    }
    if enum:
        return "str"
    return mapping.get(js_type, "Any")


def _json_type_to_zod(js_type: str, enum: list | None = None) -> str:
    if enum:
        return f'z.enum([{", ".join(repr(e) for e in enum)}])'
    mapping = {
        "string": "z.string()",
        "integer": "z.number().int()",
        "number": "z.number()",
        "boolean": "z.boolean()",
        "array": "z.array(z.any())",
        "object": "z.record(z.any())",
    }
    return mapping.get(js_type, "z.any()")


def generate_pydantic(schema_path: Path) -> str:
    with open(schema_path) as f:
        schema = json.load(f)

    lines: list[str] = []
    title = schema.get("title", "GeneratedModel")
    lines.append(f"class {title}(BaseModel):")

    required = set(schema.get("required", []))
    for prop_name, prop in schema.get("properties", {}).items():
        py_type = _json_type_to_pydantic(prop.get("type", "Any"), prop.get("enum"))
        if prop_name not in required:
            lines.append(f"    {prop_name}: {py_type} | None = None")
        else:
            lines.append(f"    {prop_name}: {py_type}")

    return "\n".join(lines)


def generate_zod(schema_path: Path) -> str:
    with open(schema_path) as f:
        schema = json.load(f)

    lines: list[str] = []
    title = schema.get("title", "GeneratedModel")
    lines.append(f"export const {title}Schema = z.object({{")

    for prop_name, prop in schema.get("properties", {}).items():
        zod_type = _json_type_to_zod(prop.get("type", "any"), prop.get("enum"))
        lines.append(f"  {prop_name}: {zod_type},")

    lines.append("});")
    lines.append(f"export type {title} = z.infer<typeof {title}Schema>;")
    return "\n".join(lines)


def main() -> None:
    schema_files = sorted(SCHEMAS_DIR.glob("*.json"))
    if not schema_files:
        print("No JSON schemas found in shared/schemas/")
        return

    # Backend Pydantic
    pydantic_lines = [
        "# Auto-generated from shared/schemas/*.json - do not edit manually",
        "from typing import Any",
        "from pydantic import BaseModel",
        "",
    ]
    for sf in schema_files:
        pydantic_lines.append(generate_pydantic(sf))
        pydantic_lines.append("")

    BACKEND_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    BACKEND_OUTPUT.write_text("\n".join(pydantic_lines))
    print(f"Generated {BACKEND_OUTPUT}")

    # Agent Zod
    zod_lines = [
        "// Auto-generated from shared/schemas/*.json - do not edit manually",
        'import { z } from "zod";',
        "",
    ]
    for sf in schema_files:
        zod_lines.append(generate_zod(sf))
        zod_lines.append("")

    AGENT_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    AGENT_OUTPUT.write_text("\n".join(zod_lines))
    print(f"Generated {AGENT_OUTPUT}")


if __name__ == "__main__":
    main()
