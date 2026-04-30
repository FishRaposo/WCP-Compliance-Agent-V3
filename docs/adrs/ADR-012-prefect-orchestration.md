# ADR-012: Prefect for ETL Pipeline Orchestration

**Status:** Accepted

**Date:** 2026-04-30

**Author:** Vinícius Raposo

---

## Context

V4 requires scheduled and on-demand ETL pipelines: DBWD rate refresh (daily), Parquet export (weekly), bulk ingestion (on-demand), and enterprise connector sync (configurable schedules). These pipelines need retry logic, scheduling, monitoring, and error alerting.

Options:
1. **Apache Airflow:** Industry standard, heavy operational overhead
2. **Dagster:** Modern, asset-centric, complex for portfolio scale
3. **Prefect:** Python-native, lightweight, good developer experience
4. **Celery Beat (extend existing):** V3 already uses Celery, but Beat is limited for complex workflows

---

## Decision

Use **Prefect 3.x** for ETL pipeline orchestration.

---

## Rationale

**Python-native:**
- Flows and tasks are plain Python functions with decorators
- No YAML DSL to learn (unlike Airflow)
- Integrates naturally with FastAPI backend (same language, same process)

**Lightweight:**
- No database dependency (Airflow requires its own PostgreSQL/MySQL)
- No web server required for development (runs flows via CLI)
- Perfect for single-developer project scale

**Modern features:**
- Native async support (matches FastAPI async architecture)
- Automatic retry with configurable backoff
- Built-in scheduling (cron, intervals)
- Dynamic task generation (generate tasks at runtime based on data)

**Better than extending Celery:**
- Celery Beat handles simple periodic tasks but not complex workflows
- Prefect provides task dependencies, state management, and visualization
- Celery continues handling V3's async job processing (Prefect handles V4's ETL)

---

## Technical Capabilities

```python
from prefect import flow, task

@task(retries=3, retry_delay_seconds=300)
async def fetch_rates():
    ...

@task
async def validate(rates):
    ...

@flow(name="dbwd-refresh")
async def dbwd_refresh_flow():
    rates = await fetch_rates()
    valid, failed = await validate(rates)
    await load(valid)
```

---

## When NOT to Use Prefect

| Scenario | Better Alternative |
|---|---|
| Enterprise-scale with hundreds of DAGs | Airflow (proven at massive scale) |
| Asset-centric data platform | Dagster (data asset tracking, lineage) |
| Real-time stream processing | Flink, Spark Streaming |
| Simple periodic tasks only | Celery Beat (already available) |

For V4's 4-5 pipelines, Prefect is the right scale.

---

## Consequences

**Positive:**
- Python-native (no context switching from FastAPI)
- Async support (consistent with backend architecture)
- Lightweight operation (no separate database or server for dev)
- Shows modern data engineering practice

**Negative:**
- One more dependency to manage
- Prefect server needed for production monitoring (adds infrastructure)
- Smaller ecosystem than Airflow

---

## Related

- ADR-014: Great Expectations (Prefect orchestrates GE validation)
- ADR-016: Parquet archival (Prefect schedules export flows)
- [V4 Data Flows](../architecture/v4-data-flows.md) — Flow 1, 4, 5 use Prefect
