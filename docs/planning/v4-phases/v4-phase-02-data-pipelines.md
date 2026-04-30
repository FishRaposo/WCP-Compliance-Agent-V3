# V4 Phase 2 — Data Pipelines

**Goal:** Add Prefect ETL orchestration and Great Expectations data quality validation. Enable scheduled DBWD rate refresh with automated quality checks and Parquet archiving.

---

## Exit Criteria (Hard Gate)

```bash
cd backend
poetry install                              # prefect + great_expectations added
poetry run pytest tests/unit -v             # All tests pass

# Test Prefect flow locally
poetry run python -m prefect deploy          # Deploy DBWD refresh flow
poetry run python -m prefect worker start    # Start worker

# Test Great Expectations suite
poetry run python -c "
from wcp_backend.quality.dbwd_expectations import validate_dbwd_rates
result = validate_dbwd_rates([{'trade': 'ELEC', 'rate': 50.0, 'fringe': 20.0}])
print(f'Passed: {result.success}')
"
# → Passed: True

# Test invalid data is caught
poetry run python -c "
from wcp_backend.quality.dbwd_expectations import validate_dbwd_rates
result = validate_dbwd_rates([{'trade': None, 'rate': -5.0, 'fringe': 20.0}])
print(f'Passed: {result.success}, Failed expectations: {result.statistics[\"unsuccessful_expectations\"]}')
"
# → Passed: False, Failed expectations: N
```

**Do not declare Phase 2 complete until Prefect can run a DBWD refresh flow and Great Expectations catches invalid data.**

---

## Goals

1. Add Prefect dependency
2. Add Great Expectations dependency
3. Create DBWD rate refresh Prefect flow
4. Create DBWD Great Expectations suite
5. Create common expectations (reusable)
6. Create decision export Prefect flow
7. Test scheduled runs locally
8. Add pipeline task tests

---

## Task Breakdown

### 2.1 — Add Dependencies

**Destination:** `backend/pyproject.toml`

```toml
[tool.poetry.dependencies]
prefect = "^3.0.0"
great-expectations = "^1.0.0"
```

```bash
cd backend
poetry add prefect great-expectations
```

---

### 2.2 — Create Great Expectations Suite for DBWD Rates

**Destination:** `backend/src/wcp_backend/quality/dbwd_expectations.py`

```python
import great_expectations as gx
from great_expectations.dataset import PandasDataset
import pandas as pd

VALID_TRADE_CODES = {
    "ELEC", "PLMB", "CARP", "IRON", "CEMENT", "BRICK",
    "PAINT", "ROOF", "ELEV", "ASBE", "LBOR", "OPER",
    "TRUCK", "MILL", "PILE", "WELD", "INSU", "SCAF",
    "TILE", "GLAZ"
}

def validate_dbwd_rates(rates: list[dict]) -> gx.ValidationResult:
    df = pd.DataFrame(rates)
    context = gx.get_context()

    suite = context.add_expectation_suite("dbwd_rate_validation")

    suite.add_expectation({
        "expectation_type": "expect_column_values_to_not_be_null",
        "kwargs": {"column": "trade"}
    })
    suite.add_expectation({
        "expectation_type": "expect_column_values_to_not_be_null",
        "kwargs": {"column": "rate"}
    })
    suite.add_expectation({
        "expectation_type": "expect_column_values_to_not_be_null",
        "kwargs": {"column": "fringe"}
    })
    suite.add_expectation({
        "expectation_type": "expect_column_values_to_be_in_set",
        "kwargs": {"column": "trade", "value_set": list(VALID_TRADE_CODES)}
    })
    suite.add_expectation({
        "expectation_type": "expect_column_values_to_be_between",
        "kwargs": {"column": "rate", "min_value": 0, "max_value": 200}
    })
    suite.add_expectation({
        "expectation_type": "expect_column_values_to_be_between",
        "kwargs": {"column": "fringe", "min_value": 0, "max_value": 100}
    })

    batch = context.data_sources.add_pandas("dbwd_source").add_dataframe_asset(name="rates").add_batch_definition_whole_dataframe(name="rates_batch")
    results = batch.get_batch().validate(suite)
    return results
```

**Acceptance:** Valid rates pass, invalid rates (null trade, negative rate) fail.

---

### 2.3 — Create Common Expectations

**Destination:** `backend/src/wcp_backend/quality/common_expectations.py`

```python
def expect_no_nulls(suite, columns: list[str]) -> None:
    for col in columns:
        suite.add_expectation({
            "expectation_type": "expect_column_values_to_not_be_null",
            "kwargs": {"column": col}
        })

def expect_in_range(suite, column: str, min_val: float, max_val: float) -> None:
    suite.add_expectation({
        "expectation_type": "expect_column_values_to_be_between",
        "kwargs": {"column": column, "min_value": min_val, "max_value": max_val}
    })

def expect_in_set(suite, column: str, values: set) -> None:
    suite.add_expectation({
        "expectation_type": "expect_column_values_to_be_in_set",
        "kwargs": {"column": column, "value_set": list(values)}
    })

def expect_unique_combination(suite, columns: list[str]) -> None:
    suite.add_expectation({
        "expectation_type": "expect_compound_columns_to_be_unique",
        "kwargs": {"column_list": columns}
    })
```

---

### 2.4 — Create DBWD Rate Refresh Flow

**Destination:** `backend/src/wcp_backend/pipelines/dbwd_refresh.py`

```python
from prefect import flow, task, get_run_logger
from datetime import timedelta
from ..quality.dbwd_expectations import validate_dbwd_rates
from ..services.db import get_connection_pool

@task(retries=3, retry_delay_seconds=300)
async def fetch_sam_gov_rates(date_range: str) -> list[dict]:
    logger = get_run_logger()
    from ..integrations.sam_gov import fetch_rates
    rates = await fetch_rates(date_range)
    logger.info(f"Fetched {len(rates)} DBWD rates from SAM.gov")
    return rates

@task
async def validate_rates(rates: list[dict]) -> tuple[list[dict], list[dict]]:
    result = validate_dbwd_rates(rates)
    if result.success:
        return rates, []
    failed_indices = set()
    for r in result.results:
        if not r.success:
            if "unexpected_index_list" in r.result:
                failed_indices.update(r.result["unexpected_index_list"])
    valid = [r for i, r in enumerate(rates) if i not in failed_indices]
    failed = [r for i, r in enumerate(rates) if i in failed_indices]
    return valid, failed

@task
async def load_rates(valid_rates: list[dict]) -> int:
    pool = await get_connection_pool()
    async with pool.acquire() as conn:
        count = 0
        for rate in valid_rates:
            await conn.execute("""
                INSERT INTO dbwd_rates (trade, locality, rate, fringe, effective_date, wage_determination_number)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (trade, locality, effective_date)
                DO UPDATE SET rate = EXCLUDED.rate, fringe = EXCLUDED.fringe
            """, rate["trade"], rate["locality"], rate["rate"], rate["fringe"],
                rate["effective_date"], rate.get("wd_number"))
            count += 1
    return count

@task
async def refresh_cache(updated_trades: list[str]) -> None:
    from ..services.redis_cache import get_redis
    redis = await get_redis()
    for trade in set(updated_trades):
        await redis.delete(f"dbwd:{trade}")

@flow(
    name="dbwd-rate-refresh",
    description="Scheduled DBWD prevailing wage rate refresh from SAM.gov",
    version="1.0.0",
)
async def dbwd_refresh_flow():
    logger = get_run_logger()

    rates = await fetch_sam_gov_rates("today")
    if not rates:
        logger.info("No new rates found")
        return {"loaded": 0, "quarantined": 0}

    valid, failed = await validate_rates(rates)
    if failed:
        logger.warning(f"Quarantined {len(failed)} invalid rates: {[r.get('trade', 'unknown') for r in failed]}")

    count = await load_rates(valid)
    await refresh_cache([r["trade"] for r in valid])

    logger.info(f"Loaded {count} rates, quarantined {len(failed)}")
    return {"loaded": count, "quarantined": len(failed)}
```

---

### 2.5 — Create Decision Export Flow

**Destination:** `backend/src/wcp_backend/pipelines/decision_export.py`

```python
from prefect import flow, task, get_run_logger
from datetime import datetime
from ..storage.parquet_writer import export_monthly_decisions

@task
async def fetch_decisions_for_month(year: int, month: int) -> list[dict]:
    pool = await get_connection_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT id, job_id, verdict, trust_score, trust_band,
                   violation_count, warning_count, reasoning_summary,
                   citations::text, cost_usd, latency_ms,
                   phoenix_trace_id, contract_id, created_at
            FROM decisions
            WHERE DATE_TRUNC('month', created_at) = MAKE_DATE($1, $2, 1)
            ORDER BY created_at
        """, year, month)
        return [dict(r) for r in rows]

@task
async def write_parquet(records: list[dict], year: int, month: int) -> str:
    path, md5 = await export_monthly_decisions(year, month, records)
    return path

@flow(name="decision-export", description="Export decisions to Parquet archive")
async def decision_export_flow(year: int | None = None, month: int | None = None):
    logger = get_run_logger()
    now = datetime.utcnow()
    y = year or now.year
    m = month or now.month

    records = await fetch_decisions_for_month(y, m)
    if not records:
        logger.info(f"No decisions found for {y}-{m:02d}")
        return {"exported": 0}

    path = await write_parquet(records, y, m)
    logger.info(f"Exported {len(records)} decisions to {path}")
    return {"exported": len(records), "path": path}
```

---

### 2.6 — Create Prefect Utilities

**Destination:** `backend/src/wcp_backend/pipelines/utils.py`

```python
from prefect import get_run_logger

async def create_ingestion_job(
    job_type: str,
    source_type: str,
    source_reference: str | None = None,
    contract_id: str | None = None,
    total_records: int = 0,
) -> str:
    pool = await get_connection_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            INSERT INTO ingestion_jobs (type, status, source_type, source_reference, contract_id, total_records)
            VALUES ($1, 'pending', $2, $3, $4, $5)
            RETURNING id
        """, job_type, source_type, source_reference, contract_id, total_records)
        return row["id"]

async def update_ingestion_job(
    job_id: str,
    status: str,
    processed: int = 0,
    failed: int = 0,
    errors: list[dict] | None = None,
) -> None:
    pool = await get_connection_pool()
    async with pool.acquire() as conn:
        await conn.execute("""
            UPDATE ingestion_jobs
            SET status = $2, processed_records = $3, failed_records = $4,
                error_details = $5, updated_at = NOW(),
                completed_at = CASE WHEN $2 IN ('completed', 'failed', 'partial') THEN NOW() ELSE completed_at END
            WHERE id = $1
        """, job_id, status, processed, failed, errors or [])
```

---

### 2.7 — Create Pipeline Tests

**Destination:** `backend/tests/unit/test_pipelines.py`

```python
import pytest
from wcp_backend.quality.dbwd_expectations import validate_dbwd_rates
from wcp_backend.quality.common_expectations import expect_no_nulls, expect_in_range

class TestDBWDExpectations:
    def test_valid_rates_pass(self):
        rates = [{"trade": "ELEC", "rate": 51.69, "fringe": 34.63, "locality": "Boston"}]
        result = validate_dbwd_rates(rates)
        assert result.success is True

    def test_null_trade_fails(self):
        rates = [{"trade": None, "rate": 51.69, "fringe": 34.63}]
        result = validate_dbwd_rates(rates)
        assert result.success is False

    def test_negative_rate_fails(self):
        rates = [{"trade": "ELEC", "rate": -5.0, "fringe": 34.63}]
        result = validate_dbwd_rates(rates)
        assert result.success is False

    def test_invalid_trade_code_fails(self):
        rates = [{"trade": "INVALID", "rate": 50.0, "fringe": 20.0}]
        result = validate_dbwd_rates(rates)
        assert result.success is False

class TestPrefectTasks:
    def test_validate_rates_returns_valid_and_failed(self):
        ...

    def test_load_rates_counts_insertions(self):
        ...
```

**Minimum: 6 quality tests + 2 pipeline tests**

---

## Architecture Notes

### Prefect Runs In-Process (No Separate Server for Dev)
During development, Prefect flows run via `prefect run` CLI or Python invocation. No Prefect server needed. For production, add `prefect server` to Docker Compose.

### Great Expectations Validates Before Write
Every ingestion pipeline runs GE validation BEFORE writing to PostgreSQL. This is the "data quality gate" — bad data never reaches the database. Failed records are quarantined (logged to `ingestion_jobs.error_details`) for human review.

### DBWD Refresh Uses Existing SAM.gov Integration
The `fetch_sam_gov_rates` task wraps V3's existing `sam_gov.py` integration. No new API code — Prefect just orchestrates the existing fetch logic with retries and scheduling.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Great Expectations API changes in v1.0 | Medium | Medium | Pin version in pyproject.toml. Write thin wrapper to isolate GX API |
| Prefect 3.x breaking changes from 2.x | Medium | Low | Prefect 3.x is current. Pin to ^3.0 |
| GE suite too strict (blocks valid data) | Medium | High | Start with permissive thresholds. Tighten after baseline established |
| SAM.gov API rate limiting | Medium | Low | Prefect retries + Redis cache handles this. Daily schedule is well within limits |

---

## Command Reference

```bash
cd backend
poetry install
poetry run pytest tests/unit/test_pipelines.py -v

# Test GE suite
poetry run python -c "from wcp_backend.quality.dbwd_expectations import validate_dbwd_rates; print(validate_dbwd_rates([{'trade':'ELEC','rate':50,'fringe':20}]).success)"

# Test Prefect flow (dry run)
poetry run python -c "from wcp_backend.pipelines.dbwd_refresh import dbwd_refresh_flow; import asyncio; asyncio.run(dbwd_refresh_flow())"
```

---

*Phase 2 document version: 2026-04-30*
*Blocked by: Phase 1 (analytics foundation) — shares DuckDB + Parquet infrastructure*
