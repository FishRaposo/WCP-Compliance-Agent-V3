# V3 to V4 Architectural Boundary

**Documenting the clean handoff between V3 (AI Decision Engine) and V4 (Enterprise Data Platform).**

---

## V3 Final State (Current)

V3 is a **complete, production-ready AI decision system** for Davis-Bacon Act payroll compliance.

### Core Capabilities

| Capability | Implementation | Status |
|---|---|---|
| **Document Processing** | Single/batch WCP PDF/text analysis | ✅ Complete |
| **AI Decision Engine** | Deterministic validation + LLM verdict + trust scoring | ✅ Complete |
| **Multi-LLM Routing** | OpenAI + Anthropic + Ollama with automatic fallback | ✅ Complete |
| **Compliance Checks** | Wage, fringe, overtime, totals, signature validation | ✅ Complete |
| **Hybrid RAG** | BM25 + pgvector + cross-encoder reranking | ✅ Complete |
| **Data Layer** | PostgreSQL, Redis, Elasticsearch | ✅ Complete |
| **Observability** | Phoenix tracing, Langfuse prompt/cost tracking | ✅ Complete |
| **Authentication** | JWT with bcrypt + jose | ✅ Complete |
| **Testing** | 250+ tests, golden set eval, regression detection | ✅ Complete |
| **CI/CD** | GitHub Actions, Vercel + Render deployment | ✅ Complete |

### Service Architecture (Unchanged in V4)

```
Frontend (React 19) → Agent (TypeScript/Hono) → Backend (Python/FastAPI)
                      ↓                             ↓
                 Mastra.ai LLM              Deterministic Pipeline
                      ↓                             ↓
                 Langfuse/Phoenix          PostgreSQL/Redis/ES
```

### V3 API Surface (Stable Contract)

| Endpoint | Service | V4 Usage |
|---|---|---|
| `POST /api/analyze` | Agent | Extended for bulk operations |
| `POST /api/analyze-pdf` | Agent | Extended for batch PDF upload |
| `GET /api/decisions` | Agent | Unchanged - V4 adds aggregate queries |
| `POST /api/jobs` | Agent | Extended for contract-level async jobs |
| `GET /health` | All | Unchanged |
| `POST /extract` | Backend | Unchanged |
| `POST /validate` | Backend | Unchanged |
| `POST /search` | Backend | Unchanged - V4 adds cross-contract search |

---

## V4 Extension Points (Future)

V4 builds **on top of V3** without modifying V3 core services.

### New Capabilities

| Capability | Technology | Relationship to V3 |
|---|---|---|
| **Contract/Payroll Database** | PostgreSQL partitioned tables | Extends V3 `decisions` table |
| **Bulk Ingestion** | Prefect ETL flows | Orchestrates V3 `/api/analyze-pdf` |
| **Enterprise Connectors** | Custom middleware framework | Calls V3 Agent API |
| **Cross-Contract Analytics** | DuckDB OLAP | Reads V3 PostgreSQL decisions |
| **Real-Time Event Stream** | Redis Streams | V3 publishes, V4 consumes |
| **Historical Search** | PostgreSQL + ES | Extends V3 hybrid RAG |

### V4-Only Data Models

```typescript
// V4 adds new tables, does not modify V3 tables
interface Contract {
  id: string;
  name: string;
  contractor_id: string;
  start_date: Date;
  end_date: Date;
  // References V3 decisions via contract_id
}

interface PayrollRecord {
  id: string;
  contract_id: string;
  week_ending: Date;
  employee_count: number;
  // Links to V3 WCP analysis results
}
```

### V4 API Boundary

Frontend clients continue to call the Agent Gateway under `/api/*`. The Agent proxies V4
requests to backend V4 routers, which are mounted under `/v4/*`. Existing V3 endpoints keep
their current paths.

| Public Endpoint | Owner | Backend Target | Description |
|---|---|---|
| `GET /api/contracts` | V4 Agent proxy | `GET /v4/contracts` | Contract management CRUD |
| `POST /api/bulk-upload` | V4 Agent proxy | `POST /v4/ingestion/bulk-upload` | Batch CSV/PDF contract ingestion |
| `GET /api/analytics/portfolio` | V4 Agent proxy | `GET /v4/analytics/portfolio` | Cross-contract DuckDB queries |
| `GET /api/ingestion/status` | V4 Agent proxy | `GET /v4/ingestion/status` | Prefect ETL job monitoring |

---

## Clean Interface Definition

### V3 → V4 Event Contract

V3 publishes decision events that V4 consumes:

```typescript
// Published by V3 Backend on decision persist
interface DecisionEvent {
  decision_id: string;
  contract_id?: string;      // V4 populates this
  status: 'approved' | 'revise' | 'rejected';
  trust_score: number;
  trust_band: 'auto_approve' | 'flag_for_review' | 'require_human_review';
  trade: string;
  locality: string;
  timestamp: string;
  model_used: string;        // OpenAI/Anthropic/Ollama
  // V4 adds: processing_time_ms, cost_usd, etc.
}
```

### V3/V4 Shared Database Schema

V3 owns these tables (V4 only reads):
- `decisions` - V3 remains the writer; V4 migration may add a nullable `contract_id`
  compatibility column, but V4 must not alter decision creation, validation, or trust scoring.
- `audit_events` - Immutable append-only
- `dbwd_rates` - V4 adds materialized views for analytics

V4 owns these tables (V3 never touches):
- `contracts`
- `payroll_records`
- `ingestion_jobs` (Prefect ETL state)

---

## Migration Path

### Phase 1: V3 in Production
1. Deploy V3 (current state)
2. Process individual WCPs via `/api/analyze`
3. Accumulate decision history in `decisions` table

### Phase 2: V4 Data Platform
1. Add `contract_id` column to V3 `decisions` table (migration)
2. Deploy V4 services alongside V3
3. Backfill contracts from existing decision metadata
4. Enable Prefect ETL for bulk ingestion

### Phase 3: Enterprise Features
1. Connect ERP/HR systems via V4 connectors
2. Enable real-time Redis Streams consumption
3. Deploy DuckDB analytics dashboards

---

## Key Design Decisions

### 1. V3 Core Unchanged
- No modifications to V3 pipeline, validation, or trust scoring
- V3 tests remain unchanged and passing
- V3 API contracts remain stable

### 2. V4 is Additive Only
- New backend modules live under `wcp_backend/{analytics,contracts,payrolls,ingestion,events,quality,storage,connectors}`
- New agent V4 proxy modules live under `agent/src/api/v4/` and `agent/src/events/`
- New frontend V4 pages/components live under dedicated V4 page/component directories
- New tables are V4-owned; any nullable V3 compatibility column must be introduced by an explicit migration and documented as non-invasive
- No changes to V3 deterministic pipeline behavior

### 3. Shared Database, Separate Schemas
- V3 tables: `public.*` schema
- V4 tables: `analytics.*` schema (DuckDB external tables)

### 4. Event-Driven Integration
- V3 publishes events to Redis Streams
- V4 consumes events asynchronously
- No synchronous calls from V3 to V4

---

## Success Criteria

V3-to-V4 transition is successful when:
- [ ] All V3 tests continue to pass (89 backend unit + 48 agent + 13 frontend + 100 eval = 250+ checks)
- [ ] V3 API response times unchanged (< 5s P99)
- [ ] V4 can ingest 1000+ WCPs/hour via bulk upload
- [ ] Cross-contract queries complete in < 2s (DuckDB)
- [ ] Zero downtime migration from V3-only to V3+V4

---

*Last updated: 2026-04-30*
*V3.1.1 Finalized - Ready for V4 Development*
