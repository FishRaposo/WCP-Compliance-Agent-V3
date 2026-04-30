# ADR-014: Great Expectations for Data Quality Validation

**Status:** Accepted

**Date:** 2026-04-30

**Author:** Vinícius Raposo

---

## Context

V4 ingests data from multiple sources: CSV uploads, PDF extractions, SAM.gov API, enterprise connectors. Every ingestion pipeline needs automated data quality validation before data reaches PostgreSQL. Invalid data must be quarantined for human review.

Options:
1. **Great Expectations (GX):** Standard data quality framework
2. **Soda Core:** SQL-based data quality checks
3. **Custom Pydantic validation:** Hand-written validation per pipeline
4. **dbt tests:** SQL tests in dbt models

---

## Decision

Use **Great Expectations** for data quality validation as code.

---

## Rationale

**Industry standard:**
- Most widely adopted data quality framework in Python ecosystem
- Recognizable in job postings and interview contexts
- Shows professional data engineering practice

**Validation as code:**
- Expectations defined in Python (version-controlled, testable)
- Suites compose from reusable expectations
- Validation results are structured (pass/fail per expectation)

**Integration with Prefect:**
- GX validation runs as a Prefect task
- Failed validation triggers quarantine flow
- Results logged to `ingestion_jobs.error_details`

**Why not custom Pydantic:**
- Pydantic validates schema (field types, required fields)
- GX validates data semantics (ranges, distributions, uniqueness, cross-column rules)
- Both are needed: Pydantic for schema, GX for data quality
- GX provides structured reporting (how many failed, which expectations)

**Why not Soda:**
- Soda uses YAML-based checks (less expressive than Python)
- Soda is SQL-focused (we need validation before database write)
- GX validates in-memory data before any database interaction

---

## Technical Capabilities

```python
# Define expectations
suite.add_expectation({
    "expectation_type": "expect_column_values_to_not_be_null",
    "kwargs": {"column": "trade"}
})
suite.add_expectation({
    "expectation_type": "expect_column_values_to_be_between",
    "kwargs": {"column": "rate", "min_value": 0, "max_value": 200}
})

# Run validation
result = batch.validate(suite)
if not result.success:
    quarantine(records)
```

---

## Validation Suites

| Suite | Target | Key Expectations |
|---|---|---|
| `dbwd_rate_validation` | DBWD rates | No nulls in trade/rate, valid trade codes, rate within historical range |
| `contract_validation` | Contract imports | No nulls in required fields, valid date ranges, unique contract numbers |
| `payroll_validation` | Payroll imports | Valid trade codes, hours <= 24/day, wage ranges, no duplicates |

---

## Consequences

**Positive:**
- Data quality as code (version-controlled, reviewable, testable)
- Structured validation results (per-expectation pass/fail)
- Reusable expectations across pipelines
- Professional data engineering practice

**Negative:**
- Learning curve for Great Expectations API (v1.0 has changed significantly)
- Validation adds latency to ingestion (~1s per batch)
- Can be overly strict if expectations are misconfigured

---

## Related

- ADR-012: Prefect (orchestrates GE validation as tasks)
- [V4 Data Flows](../architecture/v4-data-flows.md) — GE appears in Flows 1, 4, 5
- [V4 Phase 2](../planning/v4-phases/v4-phase-02-data-pipelines.md) — GE implementation details
