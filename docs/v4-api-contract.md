# V4 API Contract

**REST API specification for V4 endpoints. Extends the existing V3 API contract.**

---

## Overview

V4 adds new endpoints to both the Agent Gateway and Python Backend. All V3 endpoints remain unchanged. V4 endpoints follow the same conventions: JSON request/response, JWT authentication, standardized error format.

| Service | V4 Base URL | Consumer |
|---|---|---|
| **Agent** (TypeScript/Hono) | `http://agent:3000/api` | Frontend |
| **Backend** (Python/FastAPI) | `http://backend:8000` | Agent (proxy) |

Frontend continues to communicate only with the Agent Gateway. V4 agent routes proxy to the Python backend where needed.

---

## Agent API — V4 Endpoints (Frontend → Agent)

### Contracts

#### `GET /api/contracts`

List contracts (paginated, filterable).

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | integer | 1 | Page number |
| `per_page` | integer | 25 | Records per page (max 100) |
| `status` | string | null | Filter by status: `active`, `completed`, `terminated` |
| `contractor` | string | null | Filter by contractor name (partial match) |
| `locality` | string | null | Filter by locality (partial match) |
| `sort` | string | `created_at` | Sort field |
| `order` | string | `desc` | Sort order: `asc` or `desc` |

**Response:**
```json
{
  "items": [
    {
      "id": "abc-123",
      "contract_number": "GS-10P-2025-001",
      "project_name": "Federal Building HVAC Upgrade",
      "contractor_name": "Acme Mechanical Inc.",
      "contractor_ein": "12-3456789",
      "agency": "GSA",
      "locality": "Boston, MA",
      "start_date": "2025-01-15",
      "end_date": "2026-06-30",
      "total_value": 2500000.00,
      "status": "active",
      "source": "manual",
      "decision_count": 342,
      "latest_decision_at": "2025-04-28T14:30:00Z",
      "created_at": "2025-01-10T09:00:00Z",
      "updated_at": "2025-04-28T14:30:00Z"
    }
  ],
  "total": 156,
  "page": 1,
  "per_page": 25,
  "pages": 7
}
```

#### `GET /api/contracts/:id`

Get single contract by ID.

**Response:**
```json
{
  "id": "abc-123",
  "contract_number": "GS-10P-2025-001",
  "project_name": "Federal Building HVAC Upgrade",
  "contractor_name": "Acme Mechanical Inc.",
  "contractor_ein": "12-3456789",
  "agency": "GSA",
  "locality": "Boston, MA",
  "start_date": "2025-01-15",
  "end_date": "2026-06-30",
  "total_value": 2500000.00,
  "status": "active",
  "source": "manual",
  "source_reference": null,
  "metadata": {},
  "decision_count": 342,
  "payroll_record_count": 12450,
  "latest_decision_at": "2025-04-28T14:30:00Z",
  "created_at": "2025-01-10T09:00:00Z",
  "updated_at": "2025-04-28T14:30:00Z"
}
```

#### `POST /api/contracts`

Create a single contract.

**Request:**
```json
{
  "contract_number": "GS-10P-2025-002",
  "project_name": "Courthouse Electrical Rewiring",
  "contractor_name": "Spark Electric LLC",
  "contractor_ein": "98-7654321",
  "agency": "GSA",
  "locality": "Boston, MA",
  "start_date": "2025-03-01",
  "end_date": "2025-12-31",
  "total_value": 850000.00,
  "source": "manual"
}
```

**Response:** `201 Created` with full contract object.

#### `POST /api/contracts/bulk`

Bulk import contracts from CSV.

**Request:** `multipart/form-data` with CSV file.

**CSV Format:**
```csv
contract_number,project_name,contractor_name,contractor_ein,agency,locality,start_date,end_date,total_value
GS-10P-2025-003,Park Restroom Renovation,BuildCo Inc.,11-1111111,NPS,Denver CO,2025-02-01,2025-08-31,320000
GS-10P-2025-004,Bridge Repair,SteelWorks LLC,22-2222222,DoT,Portland OR,2025-04-01,2026-03-31,1500000
```

**Response:**
```json
{
  "job_id": "ingest-789",
  "status": "pending",
  "total_records": 2,
  "message": "Bulk import queued. Poll /api/ingestion/status/ingest-789 for progress."
}
```

#### `PUT /api/contracts/:id`

Update contract fields.

#### `DELETE /api/contracts/:id`

Soft-delete contract (sets status to `terminated`).

---

### Payrolls

#### `GET /api/payrolls`

List payroll records (paginated, filterable).

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | integer | 1 | Page number |
| `per_page` | integer | 25 | Records per page (max 100) |
| `contract_id` | string | null | Filter by contract |
| `trade_code` | string | null | Filter by trade |
| `employee_name` | string | null | Partial match on employee name |
| `week_start` | string | null | Date range start (inclusive) |
| `week_end` | string | null | Date range end (inclusive) |
| `has_violation` | boolean | null | Filter records with linked violations |

**Response:**
```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "contract_id": "abc-123",
      "employee_name": "John Smith",
      "trade_code": "ELEC",
      "locality_code": "Boston, MA",
      "week_ending": "2025-04-25",
      "total_hours": 40.0,
      "hourly_rate": 51.69,
      "gross_pay": 2067.60,
      "overtime_hours": 0.0,
      "overtime_pay": 0.00,
      "fringe_rate": 34.63,
      "fringe_total": 1385.20,
      "decision_id": "job-456",
      "decision_verdict": "Approved",
      "decision_trust_score": 0.94,
      "created_at": "2025-04-26T08:00:00Z"
    }
  ],
  "total": 12450,
  "page": 1,
  "per_page": 25,
  "pages": 498
}
```

#### `GET /api/payrolls/:id`

Get single payroll record with full detail (hours by day, linked decision).

#### `POST /api/payrolls/bulk`

Bulk import payroll records from CSV.

**Request:** `multipart/form-data` with CSV file + `contract_id` field.

**Response:** Same format as contracts bulk import (returns job_id for polling).

---

### Ingestion

#### `GET /api/ingestion/status/:job_id`

Get ingestion job status.

**Response:**
```json
{
  "job_id": "ingest-789",
  "type": "contract_import",
  "status": "processing",
  "source_type": "csv",
  "source_reference": "contracts_batch_2025-04-30.csv",
  "contract_id": null,
  "total_records": 1000,
  "processed_records": 750,
  "failed_records": 12,
  "error_details": [
    {"row": 42, "error": "invalid trade_code: 'ELECTRICIAN' (expected 'ELEC')"},
    {"row": 108, "error": "total_hours exceeds 24 in single day"}
  ],
  "started_at": "2025-04-30T10:00:00Z",
  "completed_at": null,
  "created_at": "2025-04-30T09:59:30Z"
}
```

#### `GET /api/ingestion/jobs`

List recent ingestion jobs.

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `status` | string | null | Filter: `pending`, `processing`, `completed`, `failed`, `partial` |
| `type` | string | null | Filter: `contract_import`, `payroll_import`, `dbwd_refresh` |
| `limit` | integer | 20 | Max records |

#### `POST /api/bulk-upload`

Enterprise bulk upload endpoint. Accepts CSV or PDF files for contract and payroll import.

**Request:** `multipart/form-data`
- `file`: CSV or PDF file
- `type`: `contract_import` or `payroll_import`
- `contract_id`: Required for payroll imports

**Response:** Same as ingestion status (returns job_id).

---

### Analytics

#### `GET /api/analytics/decision-volume`

Time-series decision volume data.

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `period` | string | `30d` | `7d`, `30d`, `90d`, `365d` |
| `contract_id` | string | null | Filter to single contract |
| `granularity` | string | `day` | `hour`, `day`, `week`, `month` |

**Response:**
```json
{
  "period": "30d",
  "granularity": "day",
  "data": [
    {"date": "2025-04-01", "decisions": 45, "avg_trust": 0.87, "approval_rate": 84.4},
    {"date": "2025-04-02", "decisions": 52, "avg_trust": 0.89, "approval_rate": 88.5}
  ]
}
```

#### `GET /api/analytics/compliance`

Compliance breakdown by trade and locality.

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `period` | string | `30d` | Time range |
| `contract_id` | string | null | Filter to single contract |

**Response:**
```json
{
  "by_trade": [
    {"trade": "Electrician", "total": 120, "approved": 102, "flagged": 15, "rejected": 3, "approval_rate": 85.0},
    {"trade": "Plumber", "total": 95, "approved": 88, "flagged": 5, "rejected": 2, "approval_rate": 92.6}
  ],
  "by_locality": [
    {"locality": "Boston, MA", "total": 200, "approval_rate": 87.5},
    {"locality": "Denver, CO", "total": 150, "approval_rate": 91.3}
  ],
  "violation_types": [
    {"type": "base_wage", "count": 45, "percentage": 52.3},
    {"type": "overtime", "count": 22, "percentage": 25.6},
    {"type": "fringe", "count": 14, "percentage": 16.3},
    {"type": "signature", "count": 5, "percentage": 5.8}
  ]
}
```

#### `GET /api/analytics/wages`

Wage compliance analytics.

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `period` | string | `30d` | Time range |
| `trade` | string | null | Filter to single trade |
| `contract_id` | string | null | Filter to single contract |

**Response:**
```json
{
  "violation_trend": [
    {"date": "2025-04-01", "violations": 5, "total_checked": 45, "violation_rate": 11.1},
    {"date": "2025-04-02", "violations": 3, "total_checked": 52, "violation_rate": 5.8}
  ],
  "actual_vs_required": [
    {"locality": "Boston, MA", "trade": "Electrician", "required": 51.69, "actual_avg": 52.10, "compliant_pct": 94.2},
    {"locality": "Denver, CO", "trade": "Plumber", "required": 48.50, "actual_avg": 47.80, "compliant_pct": 78.3}
  ],
  "fringe_compliance": [
    {"date": "2025-04-01", "compliant_pct": 92.5},
    {"date": "2025-04-02", "compliant_pct": 94.1}
  ]
}
```

#### `GET /api/analytics/llm`

LLM cost and performance analytics.

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `period` | string | `30d` | Time range |

**Response:**
```json
{
  "cost_per_decision": [
    {"date": "2025-04-01", "cost_usd": 0.082, "decisions": 45, "total_cost": 3.69},
    {"date": "2025-04-02", "cost_usd": 0.079, "decisions": 52, "total_cost": 4.11}
  ],
  "token_usage": [
    {"date": "2025-04-01", "prompt_tokens": 45000, "completion_tokens": 15000, "total_tokens": 60000},
    {"date": "2025-04-02", "prompt_tokens": 52000, "completion_tokens": 17000, "total_tokens": 69000}
  ],
  "model_distribution": [
    {"model": "gpt-4o", "count": 520, "percentage": 65.0, "avg_cost": 0.12},
    {"model": "claude-sonnet-3-5", "count": 200, "percentage": 25.0, "avg_cost": 0.09},
    {"model": "gpt-4o-mini", "count": 60, "percentage": 7.5, "avg_cost": 0.03},
    {"model": "llama3.2", "count": 20, "percentage": 2.5, "avg_cost": 0.00}
  ],
  "latency_by_model": [
    {"model": "gpt-4o", "p50_ms": 1800, "p95_ms": 3200, "p99_ms": 4500},
    {"model": "claude-sonnet-3-5", "p50_ms": 2100, "p95_ms": 3800, "p99_ms": 5200},
    {"model": "gpt-4o-mini", "p50_ms": 800, "p95_ms": 1500, "p99_ms": 2200},
    {"model": "llama3.2", "p50_ms": 3500, "p95_ms": 6000, "p99_ms": 8500}
  ]
}
```

#### `GET /api/analytics/overview`

Aggregated overview for the analytics dashboard landing page.

**Response:**
```json
{
  "total_decisions": 15234,
  "total_contracts": 156,
  "avg_trust_score": 0.87,
  "overall_approval_rate": 86.3,
  "total_cost_usd": 1245.67,
  "avg_cost_per_decision": 0.082,
  "human_review_queue_depth": 23,
  "period_comparison": {
    "current_period": {"decisions": 520, "approval_rate": 88.5},
    "previous_period": {"decisions": 480, "approval_rate": 85.2},
    "delta_approval_rate": 3.3,
    "delta_volume": 8.3
  }
}
```

---

### Event Streaming

#### `GET /api/events/subscribe`

SSE endpoint for real-time decision events.

**Request:**
```
GET /api/events/subscribe
Accept: text/event-stream
Authorization: Bearer <jwt_token>
```

**Response:** Server-Sent Events stream

```
event: decision
data: {"decision_id":"uuid-123","status":"Approved","trust_score":0.94,"trade":"Electrician","locality":"Boston, MA","model_used":"gpt-4o","timestamp":"2025-04-30T14:30:00Z"}

event: decision
data: {"decision_id":"uuid-456","status":"Revise","trust_score":0.62,"trade":"Plumber","locality":"Denver, CO","model_used":"gpt-4o","timestamp":"2025-04-30T14:31:00Z"}

event: heartbeat
data: {"timestamp":"2025-04-30T14:32:00Z"}
```

**Heartbeat:** Every 30 seconds to keep connection alive.

---

## Backend API — V4 Endpoints (Agent → Backend)

These endpoints are internal (not exposed to frontend). The Agent Gateway proxies to them.

### `POST /contracts`

Create contract. Returns full contract object.

### `GET /contracts`

List contracts with pagination and filters.

### `GET /contracts/:id`

Get single contract with computed stats (decision_count, payroll_record_count).

### `PUT /contracts/:id`

Update contract fields.

### `DELETE /contracts/:id`

Soft-delete contract.

### `POST /contracts/bulk`

Bulk import contracts from parsed CSV data.

**Request:**
```json
{
  "records": [
    {"contract_number": "GS-001", "project_name": "...", ...},
    {"contract_number": "GS-002", "project_name": "...", ...}
  ],
  "source": "csv",
  "source_reference": "batch_2025-04-30.csv"
}
```

**Response:**
```json
{
  "job_id": "ingest-789",
  "created": 980,
  "skipped": 15,
  "failed": 5,
  "errors": [{"row": 42, "error": "duplicate contract_number"}]
}
```

### `POST /payrolls/bulk`

Bulk import payroll records.

**Request:**
```json
{
  "contract_id": "abc-123",
  "records": [
    {"employee_name": "John Smith", "trade_code": "ELEC", ...},
    ...
  ],
  "source": "csv",
  "source_reference": "payroll_abc-123_2025-04-30.csv"
}
```

### `GET /analytics/decision-volume`

DuckDB query for decision volume time-series.

### `GET /analytics/compliance`

DuckDB query for compliance breakdown.

### `GET /analytics/wages`

DuckDB query for wage analytics.

### `GET /analytics/llm`

DuckDB query for LLM cost/performance.

### `GET /analytics/overview`

DuckDB query for dashboard overview.

### `GET /ingestion/status/:job_id`

Get ingestion job status (read from `ingestion_jobs` table).

---

## Authentication

V4 endpoints follow the same JWT authentication as V3:

- Protected routes require `Authorization: Bearer <token>` header
- `AUTH_DISABLED=true` bypasses auth in development
- Contract/payroll endpoints require authenticated user
- Analytics endpoints require authenticated user
- Event streaming requires authenticated user

---

## Error Format

Same as V3:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Bulk import contains invalid records",
    "details": {
      "total": 1000,
      "valid": 985,
      "failed": 15,
      "sample_errors": [
        {"row": 42, "error": "invalid trade_code"},
        {"row": 108, "error": "hours > 24"}
      ]
    },
    "trace_id": "trace_abc123"
  }
}
```

### V4-Specific Error Codes

| Code | HTTP | Description |
|---|---|---|
| `CONTRACT_NOT_FOUND` | 404 | Contract ID does not exist |
| `DUPLICATE_CONTRACT` | 409 | Contract number already exists |
| `INGESTION_FAILED` | 422 | Bulk import validation failed |
| `PARTITION_ERROR` | 500 | Failed to create payroll partition |
| `DUCKDB_QUERY_ERROR` | 500 | DuckDB analytics query failed |
| `CONNECTOR_UNAVAILABLE` | 503 | External system unreachable |
| `FILE_TOO_LARGE` | 413 | Upload exceeds 50MB limit |
| `INVALID_FILE_TYPE` | 415 | File must be CSV or PDF |

---

## Rate Limiting

V4 endpoints follow the same rate limits as V3:

| Endpoint Type | Rate Limit | Window |
|---|---|---|
| Analytics queries | 60 requests | per minute |
| Bulk upload | 5 requests | per minute |
| CRUD operations | 120 requests | per minute |
| Event streaming | 1 connection | per user |

---

## Related Documentation

- [V3 API Contract](api-contract.md) — V3 endpoint specifications
- [V4 Data Model & Schema](architecture/v4-data-model.md) — Table definitions
- [V4 Data Flows](architecture/v4-data-flows.md) — How endpoints trigger data flows
- [V3/V4 Boundary](planning/V3_V4_BOUNDARY.md) — V3 API surface that V4 extends

---

*Generated: 2026-04-30*
