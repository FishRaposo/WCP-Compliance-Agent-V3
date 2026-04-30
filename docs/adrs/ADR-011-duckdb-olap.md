# ADR-011: DuckDB for In-Process OLAP Analytics

**Status:** Accepted

**Date:** 2026-04-30

**Author:** Vinícius Raposo

---

## Context

V4 requires fast analytical queries across millions of compliance decisions. V3's PostgreSQL handles OLTP workloads (point lookups, single-record writes) but is 10-100x slower for analytical aggregations (GROUP BY across millions of rows, time-series rollups).

Options:
1. **Separate cloud data warehouse:** Snowflake, BigQuery, Redshift
2. **Dedicated OLAP server:** ClickHouse, Apache Druid
3. **In-process OLAP:** DuckDB
4. **PostgreSQL materialized views + indexes:** Stay with current database

---

## Decision

Use **DuckDB** as an in-process OLAP analytics engine that reads directly from PostgreSQL and Parquet files.

---

## Rationale

**No new server:**
- DuckDB runs embedded in the Python process (like SQLite, but columnar)
- No Docker container, no port, no operational overhead
- Perfect for single-developer portfolio project scale

**Reads live data directly:**
- `postgres_scan()` extension reads PostgreSQL tables without data duplication
- `read_parquet()` reads Parquet archives for historical data
- Both sources merged transparently via SQL views

**Performance:**
- Columnar storage reads only needed columns (vs. PostgreSQL row-based reads)
- Vectorized execution processes batches of rows simultaneously
- 10-100x faster than PostgreSQL for analytical queries on millions of rows

**Zero data duplication:**
- DuckDB reads from PostgreSQL and Parquet at query time
- No ETL pipeline to copy data from PG to DuckDB
- Single source of truth (PostgreSQL for operational, DuckDB for analytical)

---

## Technical Capabilities

- Full SQL support (window functions, CTEs, complex joins)
- PostgreSQL scan via `postgres_scan()` extension
- Parquet read/write via built-in `read_parquet()` / `write_parquet()`
- In-memory processing (no disk I/O for hot data)
- Zero configuration (connect and query)

---

## Integration

```python
import duckdb

con = duckdb.connect()
con.execute("INSTALL postgres; LOAD postgres;")
con.execute(f"CALL postgres_attach('{pg_conn_str}');")

# Query across live PG + Parquet archive
result = con.execute("""
    SELECT DATE_TRUNC('day', created_at), COUNT(*), AVG(trust_score)
    FROM v_all_decisions
    WHERE created_at > CURRENT_DATE - INTERVAL '30' DAY
    GROUP BY 1 ORDER BY 1
""").fetchall()
```

---

## When NOT to Use DuckDB

| Scenario | Better Alternative |
|---|---|
| Multi-user concurrent analytics | ClickHouse, Snowflake (concurrent query isolation) |
| Real-time streaming analytics | Apache Druid, Materialize |
| Data sharing across teams | Snowflake, BigQuery (data sharing features) |
| Very large datasets (>100GB) | Dedicated data warehouse |

For V4 compliance analytics (<10M records, single developer), DuckDB is the right choice.

---

## Consequences

**Positive:**
- No new infrastructure to operate
- 10-100x faster analytical queries than PostgreSQL
- Reads live PostgreSQL data (no stale copies)
- Standard SQL (no new query language to learn)
- Strong justification: "production OLAP without cloud vendor lock-in"

**Negative:**
- In-process means analytics queries compete with Python process memory
- No concurrent query isolation (single connection per request)
- PostgreSQL scan adds latency for very large tables (mitigated by Parquet archive)

---

## Related

- ADR-016: Parquet for analytical archival (DuckDB reads Parquet natively)
- ADR-015: PostgreSQL partitioning (keeps OLTP fast while DuckDB handles OLAP)
- [V4 Data Platform Architecture](../architecture/v4-data-platform.md)
