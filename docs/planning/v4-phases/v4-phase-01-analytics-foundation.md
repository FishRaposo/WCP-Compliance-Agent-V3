# V4 Phase 1 — Analytics Foundation

**Goal:** Add DuckDB OLAP engine to the Python backend, create analytics API endpoints, and build the Recharts analytics dashboard in React. This phase delivers the most visible V4 capability: cross-contract analytics over V3's existing decision data.

---

## Exit Criteria (Hard Gate)

```bash
cd backend
poetry install                              # duckdb + psycopg2 added
poetry run pytest tests/unit -v             # All existing tests pass

poetry run uvicorn wcp_backend.main:app --reload &
curl -s http://localhost:8000/analytics/overview | jq '.total_decisions'
# → Non-null number (reads from existing decisions table)

curl -s http://localhost:8000/analytics/decision-volume?period=30d | jq '.data | length'
# → Array of daily data points

curl -s http://localhost:8000/analytics/compliance | jq '.by_trade | length'
# → Array of trade breakdowns

curl -s http://localhost:8000/analytics/wages | jq '.violation_trend | length'
# → Array of daily violation data

curl -s http://localhost:8000/analytics/llm | jq '.model_distribution | length'
# → Array of model distributions

cd agent
npm ci && npm run typecheck && npm test     # 0 errors, 0 failures

cd frontend
npm ci && npm run typecheck && npm run build # 0 errors, build succeeds
npm run dev                                  # /analytics pages render with real data
```

**Do not declare Phase 1 complete until all 4 analytics endpoints return data and all 4 dashboard pages render.**

---

## Goals

1. Add DuckDB dependency to backend
2. Create analytics module with query functions
3. Add /analytics/* FastAPI endpoints
4. Create agent proxy routes for analytics
5. Add Recharts dependency to frontend
6. Build shared analytics layout components
7. Build all 4 analytics dashboard pages
8. Test analytics queries with existing V3 decision data

---

## Task Breakdown

### 1.1 — Add DuckDB Dependency

**Destination:** `backend/pyproject.toml`

```toml
[tool.poetry.dependencies]
duckdb = "^1.1.0"
psycopg2-binary = "^2.9.9"   # DuckDB postgres_scan needs psycopg2
pyarrow = "^18.0.0"          # Parquet read/write (also used by DuckDB)
```

```bash
cd backend
poetry add duckdb psycopg2-binary pyarrow
```

**Verification:**
```bash
poetry run python -c "import duckdb; con = duckdb.connect(); print(con.execute('SELECT 1').fetchone())"
# → (1,)
```

---

### 1.2 — Create DuckDB Store

**Destination:** `backend/src/wcp_backend/storage/duckdb_init.py`

```python
import duckdb
from ..config import Settings

def get_duckdb_connection(settings: Settings) -> duckdb.DuckDBPyConnection:
    con = duckdb.connect()

    con.execute("INSTALL postgres; LOAD postgres;")
    pg_conn = f"postgresql://{settings.database_user}:{settings.database_password}@{settings.database_host}:{settings.database_port}/{settings.database_name}"
    con.execute(f"CALL postgres_attach('{pg_conn}');")

    con.execute("""
        CREATE VIEW v_decisions AS
        SELECT * FROM postgres_scan('public', 'decisions')
    """)

    con.execute("""
        CREATE VIEW v_dbwd_rates AS
        SELECT * FROM postgres_scan('public', 'dbwd_rates')
    """)

    return con
```

**Acceptance:** DuckDB can read from PostgreSQL decisions table.

---

### 1.3 — Create Analytics Queries

**Destination:** `backend/src/wcp_backend/analytics/queries.py`

Each function takes a DuckDB connection and query parameters, returns a list of dicts.

```python
async def get_decision_volume(con, period_days: int, contract_id: str | None = None, granularity: str = "day") -> list[dict]:
    granularity_map = {"hour": "hour", "day": "day", "week": "week", "month": "month"}
    date_trunc = granularity_map.get(granularity, "day")

    query = f"""
        SELECT
            DATE_TRUNC('{date_trunc}', created_at)::date AS date,
            COUNT(*) AS decisions,
            AVG(trust_score) AS avg_trust,
            COUNT(CASE WHEN verdict = 'Approved' THEN 1 END) * 100.0 / COUNT(*) AS approval_rate
        FROM v_decisions
        WHERE created_at > CURRENT_DATE - INTERVAL '{period_days}' DAY
    """
    if contract_id:
        query += f" AND contract_id = '{contract_id}'"
    query += " GROUP BY 1 ORDER BY 1"

    return con.execute(query).fetchall()

async def get_compliance_breakdown(con, period_days: int, contract_id: str | None = None) -> dict:
    ...

async def get_wage_analytics(con, period_days: int, trade: str | None = None, contract_id: str | None = None) -> dict:
    ...

async def get_llm_analytics(con, period_days: int) -> dict:
    ...

async def get_overview(con, period_days: int) -> dict:
    ...
```

**Acceptance:** Each query returns correct aggregated data when pointed at a seeded PostgreSQL instance.

---

### 1.4 — Create Analytics Schemas

**Destination:** `backend/src/wcp_backend/analytics/schemas.py`

```python
from pydantic import BaseModel

class DecisionVolumePoint(BaseModel):
    date: str
    decisions: int
    avg_trust: float
    approval_rate: float

class DecisionVolumeResponse(BaseModel):
    period: str
    granularity: str
    data: list[DecisionVolumePoint]

class TradeCompliance(BaseModel):
    trade: str
    total: int
    approved: int
    flagged: int
    rejected: int
    approval_rate: float

class ComplianceResponse(BaseModel):
    by_trade: list[TradeCompliance]
    by_locality: list[dict]
    violation_types: list[dict]

class WageAnalyticsResponse(BaseModel):
    violation_trend: list[dict]
    actual_vs_required: list[dict]
    fringe_compliance: list[dict]

class ModelDistribution(BaseModel):
    model: str
    count: int
    percentage: float
    avg_cost: float

class LatencyByModel(BaseModel):
    model: str
    p50_ms: int
    p95_ms: int
    p99_ms: int

class LLMAnalyticsResponse(BaseModel):
    cost_per_decision: list[dict]
    token_usage: list[dict]
    model_distribution: list[ModelDistribution]
    latency_by_model: list[LatencyByModel]

class OverviewResponse(BaseModel):
    total_decisions: int
    total_contracts: int
    avg_trust_score: float
    overall_approval_rate: float
    total_cost_usd: float
    avg_cost_per_decision: float
    human_review_queue_depth: int
    period_comparison: dict
```

---

### 1.5 — Create Analytics Router

**Destination:** `backend/src/wcp_backend/analytics/router.py`

```python
from fastapi import APIRouter, Depends, Query
from .queries import get_decision_volume, get_compliance_breakdown, get_wage_analytics, get_llm_analytics, get_overview
from .schemas import DecisionVolumeResponse, ComplianceResponse, WageAnalyticsResponse, LLMAnalyticsResponse, OverviewResponse
from ..storage.duckdb_init import get_duckdb_connection

router = APIRouter(prefix="/analytics", tags=["analytics"])

PERIOD_MAP = {"7d": 7, "30d": 30, "90d": 90, "365d": 365}

@router.get("/overview", response_model=OverviewResponse)
async def analytics_overview(period: str = Query("30d")):
    ...

@router.get("/decision-volume", response_model=DecisionVolumeResponse)
async def analytics_decision_volume(
    period: str = Query("30d"),
    granularity: str = Query("day"),
    contract_id: str | None = Query(None),
):
    ...

@router.get("/compliance", response_model=ComplianceResponse)
async def analytics_compliance(
    period: str = Query("30d"),
    contract_id: str | None = Query(None),
):
    ...

@router.get("/wages", response_model=WageAnalyticsResponse)
async def analytics_wages(
    period: str = Query("30d"),
    trade: str | None = Query(None),
    contract_id: str | None = Query(None),
):
    ...

@router.get("/llm", response_model=LLMAnalyticsResponse)
async def analytics_llm(period: str = Query("30d")):
    ...
```

**Register in main.py:**
```python
# backend/src/wcp_backend/main.py — add to existing router includes
from .analytics.router import router as analytics_router
app.include_router(analytics_router, prefix="/v1")
```

---

### 1.6 — Create Agent Proxy Routes

**Destination:** `agent/src/api/v4-analytics.ts`

```typescript
import { Hono } from "hono";

const v4Analytics = new Hono();

v4Analytics.get("/overview", async (c) => {
  const period = c.req.query("period") || "30d";
  const res = await fetch(`${BACKEND_URL}/v1/analytics/overview?period=${period}`);
  return c.json(await res.json());
});

v4Analytics.get("/decision-volume", async (c) => {
  const params = new URLSearchParams(c.req.query());
  const res = await fetch(`${BACKEND_URL}/v1/analytics/decision-volume?${params}`);
  return c.json(await res.json());
});

v4Analytics.get("/compliance", async (c) => {
  const params = new URLSearchParams(c.req.query());
  const res = await fetch(`${BACKEND_URL}/v1/analytics/compliance?${params}`);
  return c.json(await res.json());
});

v4Analytics.get("/wages", async (c) => {
  const params = new URLSearchParams(c.req.query());
  const res = await fetch(`${BACKEND_URL}/v1/analytics/wages?${params}`);
  return c.json(await res.json());
});

v4Analytics.get("/llm", async (c) => {
  const params = new URLSearchParams(c.req.query());
  const res = await fetch(`${BACKEND_URL}/v1/analytics/llm?${params}`);
  return c.json(await res.json());
});

export { v4Analytics };
```

**Mount in server.ts:**
```typescript
app.route("/api/analytics", v4Analytics);
```

---

### 1.7 — Add Recharts Dependency

```bash
cd frontend
npm install recharts
```

---

### 1.8 — Build Shared Analytics Components

**Files to create:**
- `frontend/src/components/analytics/AnalyticsLayout.tsx`
- `frontend/src/components/analytics/ChartCard.tsx`
- `frontend/src/components/analytics/PeriodSelector.tsx`
- `frontend/src/components/analytics/KPICard.tsx`

See [V4 Analytics Dashboard Spec](../v4-analytics-dashboard.md) for full component specifications.

---

### 1.9 — Build Analytics Dashboard Pages

**Files to create:**
- `frontend/src/pages/analytics/index.tsx` — Overview (KPIs + DecisionVolumeChart + ApprovalRateChart + TopViolationsChart + TrustScoreTrend)
- `frontend/src/pages/analytics/compliance.tsx` — ApprovalRateByTrade + ApprovalRateByLocality + ViolationSeverityChart
- `frontend/src/pages/analytics/wages.tsx` — WageViolationTrend + ActualVsRequiredScatter + FringeComplianceChart
- `frontend/src/pages/analytics/llm.tsx` — LLMCostChart + TokenUsageChart + ModelDistributionChart + LatencyByModelChart

**Chart components:**
- `frontend/src/components/analytics/DecisionVolumeChart.tsx`
- `frontend/src/components/analytics/ApprovalRateChart.tsx`
- `frontend/src/components/analytics/TopViolationsChart.tsx`
- `frontend/src/components/analytics/TrustScoreTrend.tsx`
- `frontend/src/components/analytics/ApprovalRateByTradeChart.tsx`
- `frontend/src/components/analytics/ApprovalRateByLocality.tsx`
- `frontend/src/components/analytics/ViolationSeverityChart.tsx`
- `frontend/src/components/analytics/WageViolationTrendChart.tsx`
- `frontend/src/components/analytics/ActualVsRequiredScatter.tsx`
- `frontend/src/components/analytics/FringeComplianceChart.tsx`
- `frontend/src/components/analytics/LLMCostChart.tsx`
- `frontend/src/components/analytics/TokenUsageChart.tsx`
- `frontend/src/components/analytics/ModelDistributionChart.tsx`
- `frontend/src/components/analytics/LatencyByModelChart.tsx`

See [V4 Analytics Dashboard Spec](../v4-analytics-dashboard.md) for wireframe-level Recharts configurations, data shapes, and props.

---

### 1.10 — Add React Router Routes

**Update:** `frontend/src/App.tsx`

```typescript
import { lazy } from "react";

const AnalyticsOverview = lazy(() => import("./pages/analytics/index"));
const AnalyticsCompliance = lazy(() => import("./pages/analytics/compliance"));
const AnalyticsWages = lazy(() => import("./pages/analytics/wages"));
const AnalyticsLLM = lazy(() => import("./pages/analytics/llm"));

// Add to router:
<Route path="/analytics" element={<AnalyticsOverview />} />
<Route path="/analytics/compliance" element={<AnalyticsCompliance />} />
<Route path="/analytics/wages" element={<AnalyticsWages />} />
<Route path="/analytics/llm" element={<AnalyticsLLM />} />
```

---

### 1.11 — Add Analytics Tests

**Backend tests:** `backend/tests/unit/test_analytics_queries.py`

```python
import pytest
import duckdb

class TestAnalyticsQueries:
    def test_decision_volume_returns_list(self):
        con = duckdb.connect()
        con.execute("CREATE VIEW v_decisions AS SELECT * FROM read_json_auto('[{\"created_at\":\"2025-04-01\",\"verdict\":\"Approved\",\"trust_score\":0.9}]')")
        result = get_decision_volume(con, 30)
        assert isinstance(result, list)

    def test_overview_returns_required_fields(self):
        ...
```

**Frontend tests:** `frontend/src/components/analytics/KPICard.test.tsx`, etc.

---

## Architecture Notes

### DuckDB Is In-Process, Not a Server
DuckDB runs embedded in the Python process. No separate container, no port, no operational overhead. It reads PostgreSQL via the `postgres_scan` extension which uses libpq (psycopg2). Connection is created per-request (DuckDB is optimized for this pattern).

### No New Infrastructure
This phase adds zero new services. DuckDB is a Python library. The analytics queries read from the existing PostgreSQL that V3 already populates. No migrations needed (DuckDB reads existing tables).

### Analytics Queries Are Read-Only
The `/analytics/*` endpoints never write to PostgreSQL. They are pure read-only queries through DuckDB. This means they cannot corrupt V3 data.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| DuckDB postgres_scan fails with existing PG schema | Low | High | Test against V3 schema first. Fallback to raw SQL if postgres_scan incompatible |
| Large decision table makes DuckDB queries slow | Low | Medium | DuckDB is columnar and vectorized — handles millions efficiently. Add LIMIT if needed |
| Recharts bundle size too large | Low | Low | Tree-shaking works. Recharts is ~150KB gzipped for the charts we use |
| V3 tests break after adding DuckDB dependency | Low | Medium | DuckDB is import-only, no V3 code changes. Run full test suite to verify |

---

## Command Reference

```bash
# Backend
cd backend
poetry install
poetry run pytest tests/unit -v

# Agent
cd agent
npm ci && npm run typecheck && npm test

# Frontend
cd frontend
npm ci && npm run typecheck && npm run build
VITE_MOCK_API=true npm run dev   # Test with mock data first
npm run dev                       # Then test with real backend
```

---

*Phase 1 document version: 2026-04-30*
*Blocked by: V3.1.1 finalized and stable*
