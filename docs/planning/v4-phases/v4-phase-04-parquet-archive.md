# V4 Phase 4 — Parquet Archive

**Goal:** Enable weekly Parquet export of decision data for long-term analytical storage. DuckDB reads both live PostgreSQL and Parquet archives transparently, providing unified analytics across hot and cold data.

---

## Exit Criteria (Hard Gate)

```bash
cd backend
poetry run pytest tests/unit -v             # All tests pass

# Test Parquet export
poetry run python -c "
import asyncio
from wcp_backend.pipelines.decision_export import decision_export_flow
result = asyncio.run(decision_export_flow(2025, 4))
print(f'Exported: {result}')
"
# → Exported: {'exported': N, 'path': 'data/archive/decisions/2025-04.parquet'}

# Verify Parquet file is readable by DuckDB
poetry run python -c "
import duckdb
con = duckdb.connect()
result = con.execute(\"SELECT COUNT(*) FROM read_parquet('data/archive/decisions/*.parquet')\").fetchone()
print(f'Total archived records: {result[0]}')
"
# → Total archived records: N

# Verify DuckDB reads both PG and Parquet
poetry run python -c "
import duckdb
con = duckdb.connect()
con.execute('INSTALL postgres; LOAD postgres;')
con.execute(\"CREATE VIEW v_archive AS SELECT * FROM read_parquet('data/archive/decisions/*.parquet')\")
count = con.execute('SELECT COUNT(*) FROM v_archive').fetchone()
print(f'Archive count: {count[0]}')
"

# Verify MD5 integrity
poetry run python -c "
import hashlib
with open('data/archive/decisions/2025-04.parquet', 'rb') as f:
    md5 = hashlib.md5(f.read()).hexdigest()
    print(f'MD5: {md5}')
"
```

**Do not declare Phase 4 complete until DuckDB can query across PostgreSQL and Parquet in a single view.**

---

## Goals

1. Create Parquet writer with MD5 verification
2. Create DuckDB view registration (PG + Parquet)
3. Update analytics queries to use unified views
4. Schedule weekly export via Prefect
5. Add Parquet export tests
6. Verify cross-source query performance

---

## Task Breakdown

### 4.1 — Create Parquet Writer

**Destination:** `backend/src/wcp_backend/storage/parquet_writer.py`

```python
import pyarrow as pa
import pyarrow.parquet as pq
import hashlib
from pathlib import Path

DECISION_SCHEMA = pa.schema([
    pa.field("id", pa.string(), nullable=False),
    pa.field("job_id", pa.string(), nullable=False),
    pa.field("verdict", pa.string(), nullable=False),
    pa.field("trust_score", pa.float64(), nullable=False),
    pa.field("trust_band", pa.string(), nullable=False),
    pa.field("violation_count", pa.int32(), nullable=False),
    pa.field("warning_count", pa.int32(), nullable=False),
    pa.field("reasoning_summary", pa.string(), nullable=True),
    pa.field("citations", pa.string(), nullable=True),
    pa.field("cost_usd", pa.float64(), nullable=True),
    pa.field("latency_ms", pa.int32(), nullable=True),
    pa.field("phoenix_trace_id", pa.string(), nullable=True),
    pa.field("contract_id", pa.string(), nullable=True),
    pa.field("contractor_name", pa.string(), nullable=True),
    pa.field("project_name", pa.string(), nullable=True),
    pa.field("created_at", pa.timestamp("us", tz="UTC"), nullable=False),
])

async def export_monthly_decisions(year: int, month: int, records: list[dict]) -> tuple[str, str]:
    archive_dir = Path("data/archive/decisions")
    archive_dir.mkdir(parents=True, exist_ok=True)

    table = pa.Table.from_pylist(records, schema=DECISION_SCHEMA)
    path = str(archive_dir / f"{year}-{month:02d}.parquet")
    pq.write_table(table, path, compression="zstd")

    with open(path, "rb") as f:
        md5 = hashlib.md5(f.read()).hexdigest()

    return path, md5
```

---

### 4.2 — Create DuckDB Initialization with Parquet

**Destination:** `backend/src/wcp_backend/storage/duckdb_init.py` (update existing)

```python
import duckdb
from pathlib import Path

def get_duckdb_connection(pg_conn_str: str, parquet_path: str = "data/archive/decisions") -> duckdb.DuckDBPyConnection:
    con = duckdb.connect()

    con.execute("INSTALL postgres; LOAD postgres;")
    con.execute(f"CALL postgres_attach('{pg_conn_str}');")

    con.execute("""
        CREATE VIEW v_decisions AS
        SELECT * FROM postgres_scan('public', 'decisions')
    """)

    con.execute("""
        CREATE VIEW v_contracts AS
        SELECT * FROM postgres_scan('public', 'contracts')
    """)

    archive_dir = Path(parquet_path)
    if archive_dir.exists() and list(archive_dir.glob("*.parquet")):
        con.execute(f"""
            CREATE VIEW v_decisions_archive AS
            SELECT * FROM read_parquet('{parquet_path}/*.parquet')
        """)

        con.execute("""
            CREATE VIEW v_all_decisions AS
            SELECT * FROM v_decisions
            UNION ALL
            SELECT * FROM v_decisions_archive
        """)
    else:
        con.execute("CREATE VIEW v_all_decisions AS SELECT * FROM v_decisions")

    return con
```

---

### 4.3 — Update Analytics Queries

**Destination:** `backend/src/wcp_backend/analytics/queries.py` (update existing)

Change all queries from `v_decisions` to `v_all_decisions` so analytics include both live and archived data:

```python
async def get_decision_volume(con, period_days: int, contract_id: str | None = None) -> list[dict]:
    query = f"""
        SELECT
            DATE_TRUNC('day', created_at)::date AS date,
            COUNT(*) AS decisions,
            AVG(trust_score) AS avg_trust,
            COUNT(CASE WHEN verdict = 'Approved' THEN 1 END) * 100.0 / COUNT(*) AS approval_rate
        FROM v_all_decisions        -- Changed from v_decisions
        WHERE created_at > CURRENT_DATE - INTERVAL '{period_days}' DAY
    """
    ...
```

---

### 4.4 — Schedule Weekly Export

**Destination:** `backend/src/wcp_backend/pipelines/decision_export.py` (update existing)

```python
from prefect import flow, task, get_run_logger
from datetime import datetime, timedelta

@flow(
    name="weekly-decision-export",
    description="Export previous month's decisions to Parquet archive",
    version="1.0.0",
)
async def weekly_export_flow():
    now = datetime.utcnow()
    if now.day <= 7:
        previous_month = now.month - 1 or 12
        previous_year = now.year if now.month > 1 else now.year - 1
        result = await decision_export_flow(previous_year, previous_month)
        return result
    return {"skipped": True, "reason": "Not first week of month"}
```

**Prefect deployment:**
```bash
cd backend
poetry run prefect deploy --all
```

---

### 4.5 — Add Parquet Tests

**Destination:** `backend/tests/unit/test_storage.py`

```python
import pytest
import pyarrow as pa
from wcp_backend.storage.parquet_writer import export_monthly_decisions, DECISION_SCHEMA

class TestParquetWriter:
    def test_export_creates_file(self, tmp_path):
        records = [{
            "id": "test-1",
            "job_id": "job-1",
            "verdict": "Approved",
            "trust_score": 0.9,
            "trust_band": "auto",
            "violation_count": 0,
            "warning_count": 0,
            "reasoning_summary": "All checks pass",
            "citations": "[]",
            "cost_usd": 0.08,
            "latency_ms": 1800,
            "phoenix_trace_id": "trace-1",
            "contract_id": None,
            "contractor_name": "Test Corp",
            "project_name": "Test Project",
            "created_at": "2025-04-15T10:00:00Z",
        }]
        path, md5 = export_monthly_decisions(2025, 4, records)
        assert Path(path).exists()
        assert len(md5) == 32

    def test_md5_changes_with_different_data(self):
        ...

    def test_schema_validates_required_fields(self):
        ...

class TestDuckDBParquetRead:
    def test_duckdb_reads_parquet(self, tmp_path):
        import duckdb
        records = [{"id": "1", "verdict": "Approved", "trust_score": 0.9}]
        path = str(tmp_path / "test.parquet")
        table = pa.Table.from_pylist(records, schema=DECISION_SCHEMA)
        pa.parquet.write_table(table, path)

        con = duckdb.connect()
        result = con.execute(f"SELECT COUNT(*) FROM read_parquet('{path}')").fetchone()
        assert result[0] == 1
```

**Minimum: 4 storage tests**

---

## Architecture Notes

### Parquet Is Write-Once, Append-Only
Each monthly file is written once. If re-export is needed (data correction), the entire month is re-exported. This simplifies the integrity model — no partial updates.

### DuckDB Auto-Detects New Parquet Files
When DuckDB initializes, it scans the Parquet directory. New monthly files are automatically included in `v_decisions_archive`. No configuration update needed.

### Compression: ZSTD
Parquet files use ZSTD compression (better ratio than Snappy, faster than GZIP). Typical compression: 10x on structured decision data. 1M decisions ≈ 50MB Parquet.

### No Data Duplication
Parquet is an archive, not a cache. DuckDB reads it directly. No ETL pipeline copies data from PG to Parquet to DuckDB. DuckDB reads both sources at query time.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Parquet file corruption | Low | High | MD5 verification on write. Re-export from PG if corrupted |
| DuckDB can't read Parquet schema | Low | Medium | Schema is fixed and versioned. Test with real data before scheduling |
| Export runs out of memory on large months | Low | Medium | DuckDB and PyArrow are memory-efficient for columnar data. Add batch export if needed |
| S3/cloud storage needed | Low | Low | Local filesystem sufficient for single-developer scale. Cloud storage is V4.2 scope |

---

## Command Reference

```bash
cd backend
poetry run pytest tests/unit/test_storage.py -v

# Manual export
poetry run python -c "
import asyncio
from wcp_backend.pipelines.decision_export import decision_export_flow
print(asyncio.run(decision_export_flow(2025, 4)))
"

# Verify archive
poetry run python -c "
import duckdb
con = duckdb.connect()
print(con.execute(\"SELECT COUNT(*) FROM read_parquet('data/archive/decisions/*.parquet')\").fetchone())
"
```

---

*Phase 4 document version: 2026-04-30*
*Blocked by: Phase 2 (data pipelines) — uses Prefect for scheduling*
