# ADR-015: PostgreSQL Table Partitioning for Payroll Records

**Status:** Accepted

**Date:** 2026-04-30

**Author:** Vinícius Raposo

---

## Context

V4 stores millions of payroll records in PostgreSQL. Without partitioning, queries that filter by contract or date range require full table scans. As the table grows from thousands to millions of rows, query performance degrades linearly.

Options:
1. **List partitioning by `contract_id`:** Each contract gets its own partition
2. **Range partitioning by `week_ending`:** Monthly/quarterly date-based partitions
3. **Hash partitioning by `id`:** Even distribution but no query pruning
4. **No partitioning:** Rely on indexes alone
5. **TimescaleDB:** PostgreSQL extension for time-series

---

## Decision

Use **PostgreSQL 16 native list partitioning by `contract_id`** for the `payroll_records` table.

---

## Rationale

**Query pattern is contract-first:**
- Most queries filter by `contract_id` first, then by date range
- "Show me all payroll records for contract X between January and March"
- List partitioning by `contract_id` enables partition pruning at query time

**Automatic partition pruning:**
- `WHERE contract_id = 'abc'` → PostgreSQL scans only the `payroll_records_contract_abc` partition
- Other partitions are completely skipped (zero I/O)
- No application-level logic needed — PostgreSQL handles pruning automatically

**Why not range partitioning by date:**
- Cross-contract queries would scan all date partitions
- A single contract's data is scattered across many partitions
- Date partitions don't align with the dominant query pattern

**Why not TimescaleDB:**
- Adds a PostgreSQL extension dependency
- TimescaleDB optimizes for time-series-first queries (sensor data, metrics)
- Payroll queries are contract-first, time-range-second
- Native partitioning handles the actual query pattern without an extension

**Dynamic partition management:**
- Partitions are created when a contract first receives payroll data
- `ensure_partition()` is idempotent (CREATE TABLE IF NOT EXISTS)
- No empty partitions for contracts without payroll data

---

## Technical Implementation

```sql
-- Parent table (partitioned)
CREATE TABLE payroll_records (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    contract_id TEXT NOT NULL REFERENCES contracts(id),
    employee_name TEXT NOT NULL,
    trade_code TEXT NOT NULL,
    week_ending DATE NOT NULL,
    total_hours NUMERIC(5,1) NOT NULL,
    hourly_rate NUMERIC(8,2) NOT NULL,
    gross_pay NUMERIC(10,2) NOT NULL,
    PRIMARY KEY (id, contract_id)
) PARTITION BY LIST (contract_id);

-- Per-contract partition (created dynamically)
CREATE TABLE payroll_records_contract_abc
    PARTITION OF payroll_records
    FOR VALUES IN ('abc');
```

---

## When NOT to Use List Partitioning

| Scenario | Better Alternative |
|---|---|
| Thousands of small contracts (too many partitions) | Hash partitioning (fixed partition count) |
| Queries are always time-range based | Range partitioning by date |
| Multi-tenant SaaS with millions of tenants | Application-level sharding |
| Geographic distribution required | Citus (distributed PostgreSQL) |

For V4's scale (100s of contracts, not millions), list partitioning is ideal.

---

## Consequences

**Positive:**
- Query performance stays constant as data grows (partition pruning)
- No new infrastructure (native PostgreSQL feature)
- Dynamic partition creation (no manual management)
- Partitions can be individually maintained (REINDEX, VACUUM per partition)

**Negative:**
- Composite primary key required (must include partition key)
- Cross-partition queries are slower (UNION ALL across partitions)
- Partition count grows with contract count (manageable at hundreds, not thousands)

---

## Related

- ADR-011: DuckDB (reads partitioned tables for analytics)
- [V4 Data Model](../architecture/v4-data-model.md) — Full partitioning DDL
- [V4 Phase 6](../planning/v4-phases/v4-phase-06-contract-payroll.md) — Partition creation in bulk import
