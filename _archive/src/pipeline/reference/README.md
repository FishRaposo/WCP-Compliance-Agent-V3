# Pipeline Reference Materials

This directory contains all reference materials used by the WCP Compliance Agent pipeline.

## Purpose

- **Auditability**: Clear, version-controlled sources for all regulatory references and operational values
- **Model Access**: Structured materials that can be easily loaded into prompts or retrieved by the LLM
- **Human Review**: Organized documentation for auditors to verify compliance logic

## Structure

```
reference/
├── README.md (this file)
├── legislation/        # Regulatory citations and text
├── values/            # Reference values (DBWD rates, thresholds, etc.)
└── instructions/      # Agent operating instructions and prompts
```

## Usage

These materials are referenced by:
- Layer 1 (Deterministic): Hardcoded rules reference `values/` for thresholds and rates
- Layer 2 (LLM Verdict): System prompt incorporates `instructions/` and `legislation/`
- Layer 3 (Trust Score): Trust thresholds defined in `values/`

## Updating Reference Materials

When updating regulatory references or values:
1. Update the appropriate file in this directory
2. Add a comment with the source and date
3. Update any tests that reference these values
4. Commit with clear message describing the change

## Version Control

All reference materials are version-controlled. Changes should be:
- Clearly documented in commit messages
- Tracked in CHANGELOG.md
- Reviewed for accuracy before merging
