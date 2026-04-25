# API Reference

**Base URL:** `http://localhost:3000` (local) or your deployed endpoint

All endpoints return JSON and are rate-limited to **60 requests per minute per IP**.

---

## `POST /api/analyze`

Analyze a payroll submission through the three-layer compliance pipeline.

### Request

```json
{
  "content": "Role: Electrician, Hours: 40, Wage: 51.69, Fringe: 34.63"
}
```

### Response

```json
{
  "finalStatus": "Approved",
  "deterministic": {
    "role": "Electrician",
    "hours": 40,
    "wage": 51.69,
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
  },
  "verdict": {
    "status": "Approved",
    "rationale": "All checks pass. Wage meets prevailing rate.",
    "referencedCheckIds": ["wage_check_001"],
    "citations": ["40 U.S.C. § 3142", "29 CFR 5.5(a)(1)"]
  },
  "trust": {
    "score": 0.92,
    "band": "auto"
  },
  "humanReview": {
    "required": false
  },
  "auditTrail": [
    {
      "layer": "layer1",
      "action": "extraction",
      "timestamp": "2026-04-22T10:00:00Z"
    }
  ],
  "traceId": "abc-123"
}
```

### Response Fields

| Field | Type | Description |
|---|---|---|
| `finalStatus` | string | `Approved`, `Flagged`, or `NeedsReview` |
| `deterministic` | object | Layer 1 extraction and rule check results |
| `deterministic.checks` | array | Individual compliance checks with regulation citations |
| `verdict` | object | Layer 2 LLM reasoning over Layer 1 findings |
| `verdict.citations` | string[] | Statutes cited by the LLM |
| `trust` | object | Layer 3 trust score and routing band |
| `trust.band` | string | `auto` (≥0.75), `flag` (0.60–0.74), `human` (<0.60) |
| `humanReview` | object | Whether human review is required |
| `auditTrail` | array | Timestamped record of every pipeline step |
| `traceId` | string | Unique identifier for this decision (for appeals) |

---

## `POST /api/analyze-pdf`

Upload a PDF payroll document for analysis.

### Request

- **Content-Type:** `multipart/form-data`
- **Field:** `file` (PDF, max 64KB)

### Response

Same schema as `POST /api/analyze`.

---

## `POST /api/analyze-csv`

Upload a CSV bulk payroll file for analysis.

### Request

- **Content-Type:** `multipart/form-data`
- **Field:** `file` (CSV, max 64KB)

### Response

Array of analysis results, one per row.

---

## `GET /api/decisions`

List persisted compliance decisions.

### Query Parameters

| Parameter | Type | Description |
|---|---|---|
| `limit` | number | Max results (default: 50) |
| `offset` | number | Pagination offset |
| `status` | string | Filter by `Approved`, `Flagged`, or `NeedsReview` |

### Response

```json
{
  "decisions": [...],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

**Note:** Requires PostgreSQL backend. Falls back to in-memory storage when unavailable.

---

## `POST /api/jobs`

Submit an async analysis job for large files or batch processing.

### Request

Same as `POST /api/analyze` or multipart for PDF/CSV.

### Response

```json
{
  "jobId": "job-abc-123",
  "status": "pending",
  "estimatedTime": "30s"
}
```

---

## `GET /api/jobs/:id`

Check async job status and retrieve results.

### Response

```json
{
  "jobId": "job-abc-123",
  "status": "completed",
  "result": { ... },
  "completedAt": "2026-04-22T10:01:00Z"
}
```

---

## `GET /health`

Server status and configuration.

### Response

```json
{
  "status": "ok",
  "mockMode": true,
  "model": "gpt-4o-mini",
  "version": "2.0.0"
}
```

---

## Error Responses

All errors follow this schema:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Missing required field: content",
    "details": { ... }
  }
}
```

### Common Error Codes

| Code | HTTP Status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Request schema violation |
| `RATE_LIMITED` | 429 | Too many requests (60/min) |
| `INVALID_DOCUMENT` | 400 | PDF/CSV parsing failure |
| `LLM_UNAVAILABLE` | 503 | OpenAI API error |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Rate Limiting

All endpoints are limited to **60 requests per minute per IP address**. The limit resets every 60 seconds.

**Headers returned on every request:**

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1713782400
```

---

## Mock Mode

Set `OPENAI_API_KEY=mock` to run without calling the OpenAI API. All LLM responses return deterministic mock data. Perfect for:

- Development without API costs
- CI/CD pipelines
- Offline testing
- Demo environments

Mock mode is detected automatically when the API key starts with `mock` or `test-`.

---

*See [Quick Start](../quick-start.md) for setup instructions.*
