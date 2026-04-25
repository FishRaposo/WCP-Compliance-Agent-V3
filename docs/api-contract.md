# API Contract

**REST API specification for inter-service communication.**

---

## Overview

| Service | Base URL | Consumer |
|---|---|---|
| **Agent** (TypeScript/Hono) | `http://agent:3000` | Frontend |
| **Backend** (Python/FastAPI) | `http://backend:8000` | Agent |

Frontend never talks directly to Backend. All requests flow through Agent.

---

## Agent API (Frontend → Agent)

### `POST /api/analyze`

Submit WCP text for analysis.

**Request:**
```json
{
  "content": "Role: Electrician, Hours: 40, Wage: 51.69, Fringe: 34.63",
  "metadata": {
    "contractor_id": "cont_123",
    "project_id": "proj_456"
  }
}
```

**Response:**
```json
{
  "final_status": "Approved",
  "deterministic": {
    "extracted": { "role": "Electrician", "hours": 40, ... },
    "checks": [...],
    "score": 1.0
  },
  "verdict": {
    "status": "Approved",
    "rationale": "All checks pass...",
    "citations": ["40 U.S.C. § 3142"]
  },
  "trust": {
    "score": 0.92,
    "band": "auto"
  },
  "trace_id": "trace_abc123"
}
```

### `POST /api/analyze-pdf`

Multipart upload for PDF payroll forms.

### `POST /api/analyze-csv`

Bulk upload for CSV files.

### `GET /api/decisions`

List all decisions (paginated).

### `GET /api/decisions/:id`

Get single decision by ID.

### `POST /api/jobs`

Submit async job (returns job ID for polling).

### `GET /api/jobs/:id`

Get job status and result.

---

## Backend API (Agent → Backend)

### `POST /extract`

Extract structured data from WCP text.

**Request:**
```json
{ "content": "Role: Electrician, Hours: 40..." }
```

**Response:**
```json
{
  "worker_name": "John Doe",
  "trade_code": "ELEC",
  "hours": 40,
  "gross_pay": 2067.60,
  ...
}
```

### `POST /validate`

Run deterministic checks.

**Request:**
```json
{
  "extracted": { ... },
  "dbwd_rate": { ... }
}
```

**Response:**
```json
{
  "checks": [
    {
      "id": "wage_check_001",
      "type": "base_wage",
      "status": "pass",
      "regulation": "40 U.S.C. § 3142",
      "message": "Wage meets prevailing rate"
    }
  ],
  "score": 1.0
}
```

### `GET /dbwd/{trade}/{locality}`

Lookup DBWD rate for trade and locality.

**Response:**
```json
{
  "trade": "Electrician",
  "locality": "Boston, MA",
  "base_wage": 51.69,
  "fringe": 34.63,
  "effective_date": "2024-06-01"
}
```

### `POST /search`

Hybrid RAG search.

**Request:**
```json
{
  "query": "Electrician prevailing wage Boston",
  "trade": "ELEC",
  "k": 10
}
```

**Response:**
```json
{
  "results": [
    {
      "id": "dbwd_001",
      "content": "...",
      "similarity": 0.95
    }
  ]
}
```

### `POST /decisions`

Persist decision to database.

### `GET /health`

Health check.

---

## Error Format

Standard error response:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Wage below prevailing rate",
    "details": { "expected": 51.69, "actual": 45.00 },
    "trace_id": "trace_abc123"
  }
}
```

---

## Authentication

TBD: API key or JWT per-organization.

---

## Versioning

API version in URL: `/v1/extract`

Backward-compatible changes: patch version
Breaking changes: new major version
