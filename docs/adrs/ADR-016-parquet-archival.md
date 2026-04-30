# ADR-016: Apache Parquet for Analytical Archival

**Status:** Accepted

**Date:** 2026-04-30

**Author:** Vinícius Raposo

---

## Context

V4 accumulates millions of compliance decisions over time. PostgreSQL handles operational queries well, but retaining years of historical data in PostgreSQL increases table size, slows vacuum operations, and increases storage costs. Historical data needs to be archived in a format optimized for analytical queries.

Options:
1. **Apache Parquet:** Columnar storage, standard data engineering format
2. **CSV:** Simple text format, universally compatible
3. **JSON/JSONL:** Semi-structured text format
4. **Apache Avro:** Row-oriented, schema-evolution friendly
5. **No archival:** Keep everything in PostgreSQL

---

## Decision

Use **Apache Parquet** for monthly decision archive storage.

---

## Rationale

**Columnar storage:**
- Only reads columns needed for a query (vs. CSV/JSON reads entire rows)
- 10-100x faster for analytical queries on selected columns
- Native format for DuckDB (direct read, zero conversion)

**Efficient compression:**
- ZSTD compression achieves 10x ratio on structured decision data
- 1M decisions ≈ 50MB Parquet (vs. ~500MB CSV)
- Column-level compression exploits data patterns (trade codes repeat, dates are sequential)

**DuckDB-native:**
- `read_parquet('archive/*.parquet')` — no imports, no conversion
- DuckDB reads Parquet directly into its columnar engine
- Zero-copy read path (no parsing overhead)

**Standard data engineering format:**
- Parquet is the de facto standard for analytical storage
- Compatible with Spark, Pandas, Arrow, Athena, BigQuery
- Shows professional data engineering practice

**Why not CSV:**
- Text parsing is slow for large files
- No type information (everything is strings)
- No compression (10x larger files)
- DuckDB can read CSV but columnar reads are faster

**Why not keep everything in PostgreSQL:**
- Table bloat slows VACUUM and ANALYZE
- Operational queries (V3) compete with analytical queries (V4)
- 7-year retention in PostgreSQL is expensive
- Parquet archive + DuckDB separates hot and cold data

---

## Technical Implementation

```
data/archive/decisions/
├── 2025-01.parquet    # January decisions
├── 2025-02.parquet    # February decisions
└── ...
```

```python
# Write monthly archive
table = pa.Table.from_pylist(records, schema=DECISION_SCHEMA)
pq.write_table(table, path, compression="zstd")

# Read from DuckDB
con.execute("SELECT * FROM read_parquet('data/archive/decisions/*.parquet')")
```

---

## Consequences

**Positive:**
- 10x compression reduces storage costs
- DuckDB reads Parquet natively (zero conversion)
- Columnar reads are 10-100x faster than row-based for analytics
- Standard format (portable to any analytical tool)
- Separates hot (PostgreSQL) and cold (Parquet) data

**Negative:**
- Binary format (not human-readable like CSV)
- Write-once (no row-level updates — full month re-export needed for corrections)
- Requires PyArrow dependency
- Directory management (archive cleanup, S3 upload for production)

---

## Related

- ADR-011: DuckDB (reads Parquet archives for analytics)
- ADR-012: Prefect (schedules weekly Parquet export)
- [V4 Data Model](../architecture/v4-data-model.md) — Parquet schema definition
