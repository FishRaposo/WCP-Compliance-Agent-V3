# V4 Phase 6 — Contract/Payroll CRUD & Bulk Ingestion

**Goal:** Add persistent contract and payroll record management with full CRUD, PostgreSQL partitioning, bulk CSV/PDF import, and the `/contracts`, `/payrolls`, and `/ingestion` frontend pages. This phase delivers the core enterprise data management capability.

---

## Exit Criteria (Hard Gate)

```bash
cd backend
poetry run pytest tests/unit -v             # All tests pass
poetry run alembic upgrade head             # Migration 006 applied

# Test contract CRUD
curl -X POST http://localhost:8000/v1/contracts -H 'Content-Type: application/json' -d '{
  "contract_number": "GS-TEST-001",
  "project_name": "Test Project",
  "contractor_name": "Test Contractor",
  "locality": "Boston, MA",
  "start_date": "2025-01-01",
  "end_date": "2025-12-31"
}'
# → 201 Created with contract ID

curl http://localhost:8000/v1/contracts
# → List with 1 contract

curl http://localhost:8000/v1/contracts/{id}
# → Single contract with decision_count, payroll_record_count

# Test bulk import
curl -X POST http://localhost:8000/v1/contracts/bulk \
  -F "file=@test_contracts.csv"
# → {job_id: "...", created: N, failed: 0}

# Test payroll import
curl -X POST http://localhost:8000/v1/payrolls/bulk \
  -H 'Content-Type: application/json' \
  -d '{"contract_id": "...", "records": [...], "source": "csv"}'
# → {job_id: "...", created: N, failed: 0}

# Test ingestion status
curl http://localhost:8000/v1/ingestion/status/{job_id}
# → {status: "completed", processed_records: N, failed_records: 0}

# Test partition was created
psql -c "\dt payroll_records_*" $DATABASE_URL
# → Shows payroll_records_contract_{id} partition

# Agent proxy
cd agent
npm ci && npm run typecheck && npm test     # 0 errors, 0 failures

curl http://localhost:3000/api/contracts
# → Same data as backend

# Frontend pages
cd frontend
npm ci && npm run typecheck && npm run build # 0 errors
# /contracts page renders contract list
# /payrolls page renders payroll browser
# /ingestion page shows job history
```

**Do not declare Phase 6 complete until contracts and payrolls can be created, listed, bulk-imported, and browsed through the frontend.**

---

## Goals

1. Create migration 006 (V4 tables + contract_id FK on decisions)
2. Create contracts module (model, service, schemas, router)
3. Create payrolls module (model, service, schemas, router)
4. Create ingestion module (processor, tasks, schemas, router)
5. Create agent proxy routes
6. Create frontend pages (/contracts, /payrolls, /ingestion)
7. Add module tests
8. Verify PostgreSQL partitioning works

---

## Task Breakdown

### 6.1 — Create Migration 006

**Destination:** `backend/migrations/versions/006_v4_foundation.py`

```python
"""V4 Data Platform: contracts, payroll_records, ingestion_jobs, connector_configs.
Adds contract_id FK to existing decisions table.
"""

def upgrade():
    # 1. Create contracts table first (FK reference)
    op.create_table(
        "contracts",
        sa.Column("id", sa.String(), primary_key=True, server_default=sa.text("gen_random_uuid()::text")),
        sa.Column("contract_number", sa.String(), unique=True, nullable=False),
        sa.Column("project_name", sa.Text(), nullable=False),
        sa.Column("contractor_name", sa.Text(), nullable=False),
        sa.Column("contractor_ein", sa.String()),
        sa.Column("agency", sa.String()),
        sa.Column("locality", sa.Text(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date()),
        sa.Column("total_value", sa.Numeric(14, 2)),
        sa.Column("status", sa.String(), nullable=False, server_default="active"),
        sa.Column("source", sa.String(), nullable=False, server_default="manual"),
        sa.Column("source_reference", sa.String()),
        sa.Column("metadata", sa.dialects.postgresql.JSONB(), server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # 2. Add contract_id to decisions
    op.add_column("decisions", sa.Column("contract_id", sa.String(), nullable=True))
    op.create_foreign_key("fk_decisions_contract", "decisions", "contracts", ["contract_id"], ["id"])
    op.create_index("ix_decisions_contract_id", "decisions", ["contract_id"])
    op.create_index("ix_decisions_contract_created", "decisions", ["contract_id", "created_at"])

    # 3. Create ingestion_jobs
    op.create_table(
        "ingestion_jobs",
        sa.Column("id", sa.String(), primary_key=True, server_default=sa.text("gen_random_uuid()::text")),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("source_type", sa.String(), nullable=False),
        sa.Column("source_reference", sa.String()),
        sa.Column("contract_id", sa.String(), sa.ForeignKey("contracts.id")),
        sa.Column("total_records", sa.Integer(), server_default="0"),
        sa.Column("processed_records", sa.Integer(), server_default="0"),
        sa.Column("failed_records", sa.Integer(), server_default="0"),
        sa.Column("error_details", sa.dialects.postgresql.JSONB(), server_default="[]"),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # 4. Create payroll_records (partitioned)
    op.execute("""
        CREATE TABLE payroll_records (
            id UUID NOT NULL DEFAULT gen_random_uuid(),
            contract_id TEXT NOT NULL REFERENCES contracts(id),
            employee_name TEXT NOT NULL,
            employee_id_hash TEXT,
            trade_code TEXT NOT NULL,
            locality_code TEXT NOT NULL,
            week_ending DATE NOT NULL,
            hours_monday NUMERIC(4,1),
            hours_tuesday NUMERIC(4,1),
            hours_wednesday NUMERIC(4,1),
            hours_thursday NUMERIC(4,1),
            hours_friday NUMERIC(4,1),
            hours_saturday NUMERIC(4,1),
            hours_sunday NUMERIC(4,1),
            total_hours NUMERIC(5,1) NOT NULL,
            hourly_rate NUMERIC(8,2) NOT NULL,
            gross_pay NUMERIC(10,2) NOT NULL,
            fringe_rate NUMERIC(8,2),
            fringe_total NUMERIC(10,2),
            overtime_hours NUMERIC(5,1) DEFAULT 0,
            overtime_pay NUMERIC(10,2) DEFAULT 0,
            decision_id TEXT REFERENCES decisions(job_id),
            source_file TEXT,
            ingestion_job_id TEXT REFERENCES ingestion_jobs(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (id, contract_id)
        ) PARTITION BY LIST (contract_id)
    """)

    # 5. Create connector_configs
    op.create_table(
        "connector_configs",
        sa.Column("id", sa.String(), primary_key=True, server_default=sa.text("gen_random_uuid()::text")),
        sa.Column("name", sa.String(), unique=True, nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("connection_config", sa.dialects.postgresql.JSONB(), nullable=False),
        sa.Column("schedule_cron", sa.String()),
        sa.Column("last_sync_at", sa.DateTime(timezone=True)),
        sa.Column("last_sync_status", sa.String()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("metadata", sa.dialects.postgresql.JSONB(), server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

def downgrade():
    op.drop_table("connector_configs")
    op.execute("DROP TABLE IF EXISTS payroll_records")
    op.drop_table("ingestion_jobs")
    op.drop_index("ix_decisions_contract_created")
    op.drop_index("ix_decisions_contract_id")
    op.drop_constraint("fk_decisions_contract", "decisions", type_="foreignkey")
    op.drop_column("decisions", "contract_id")
    op.drop_table("contracts")
```

```bash
cd backend
poetry run alembic revision --autogenerate -m "006_v4_foundation"
poetry run alembic upgrade head
```

---

### 6.2 — Create Contracts Module

**Files to create:**
- `backend/src/wcp_backend/contracts/__init__.py`
- `backend/src/wcp_backend/contracts/models.py` — SQLAlchemy 2.0 Contract model
- `backend/src/wcp_backend/contracts/schemas.py` — Pydantic request/response schemas
- `backend/src/wcp_backend/contracts/service.py` — CRUD + bulk import logic
- `backend/src/wcp_backend/contracts/router.py` — FastAPI endpoints

See [V4 Data Model](../../architecture/v4-data-model.md) for full model definitions.

**Key service functions:**
```python
async def create_contract(data: ContractCreate) -> Contract
async def get_contract(contract_id: str) -> Contract | None
async def list_contracts(filters: ContractFilters, page: int, per_page: int) -> PaginatedContracts
async def update_contract(contract_id: str, data: ContractUpdate) -> Contract
async def delete_contract(contract_id: str) -> None  # Soft delete (status='terminated')
async def bulk_import_contracts(records: list[dict], source: str) -> BulkImportResult
```

---

### 6.3 — Create Payrolls Module

**Files to create:**
- `backend/src/wcp_backend/payrolls/__init__.py`
- `backend/src/wcp_backend/payrolls/models.py` — SQLAlchemy 2.0 PayrollRecord model (partitioned)
- `backend/src/wcp_backend/payrolls/schemas.py` — Pydantic request/response schemas
- `backend/src/wcp_backend/payrolls/service.py` — CRUD + search + partition management
- `backend/src/wcp_backend/payrolls/router.py` — FastAPI endpoints

**Key service functions:**
```python
async def ensure_partition(contract_id: str) -> None
async def bulk_import_payrolls(contract_id: str, records: list[dict], source: str) -> BulkImportResult
async def list_payrolls(filters: PayrollFilters, page: int, per_page: int) -> PaginatedPayrolls
async def get_payroll(payroll_id: str, contract_id: str) -> PayrollRecord | None
async def search_payrolls(query: str, contract_id: str | None, date_range: tuple) -> list[PayrollRecord]
```

---

### 6.4 — Create Ingestion Module

**Files to create:**
- `backend/src/wcp_backend/ingestion/__init__.py`
- `backend/src/wcp_backend/ingestion/processor.py` — CSV/PDF parsing, validation orchestration
- `backend/src/wcp_backend/ingestion/schemas.py` — Ingestion job schemas
- `backend/src/wcp_backend/ingestion/router.py` — FastAPI endpoints

**Key processor functions:**
```python
async def parse_csv(file_content: bytes) -> list[dict]
async def validate_records(records: list[dict], type: str) -> tuple[list[dict], list[dict]]
async def process_bulk_upload(file: UploadFile, type: str, contract_id: str | None) -> IngestionJob
async def get_ingestion_status(job_id: str) -> IngestionJob | None
async def list_ingestion_jobs(filters: JobFilters, limit: int) -> list[IngestionJob]
```

---

### 6.5 — Create Agent Proxy Routes

**Files to create:**
- `agent/src/api/v4-contracts.ts` — `/api/contracts/*`
- `agent/src/api/v4-payrolls.ts` — `/api/payrolls/*`
- `agent/src/api/v4-ingestion.ts` — `/api/ingestion/*`, `/api/bulk-upload`

Each file proxies to the corresponding backend endpoint with auth context.

**Mount in server.ts:**
```typescript
app.route("/api/contracts", v4Contracts);
app.route("/api/payrolls", v4Payrolls);
app.route("/api/ingestion", v4Ingestion);
```

---

### 6.6 — Create Frontend Pages

**Files to create:**

`frontend/src/pages/Contracts.tsx`:
- Contract list with search, filters (status, contractor, locality)
- Create contract dialog
- Bulk import CSV upload
- Contract detail view with linked decisions and payroll records

`frontend/src/pages/Payrolls.tsx`:
- Payroll record browser with search (employee, trade, date range)
- Filter by contract
- Bulk import CSV upload
- Record detail view with linked decision

`frontend/src/pages/Ingestion.tsx`:
- Ingestion job list with status badges
- Job detail with progress bar and error details
- Start new import flow

**Update routing in `frontend/src/App.tsx`:**
```typescript
const Contracts = lazy(() => import("./pages/Contracts"));
const Payrolls = lazy(() => import("./pages/Payrolls"));
const Ingestion = lazy(() => import("./pages/Ingestion"));

<Route path="/contracts" element={<Contracts />} />
<Route path="/payrolls" element={<Payrolls />} />
<Route path="/ingestion" element={<Ingestion />} />
```

---

### 6.7 — Add Module Tests

**Backend tests:** `backend/tests/unit/test_contracts.py`, `test_payrolls.py`, `test_ingestion.py`

```python
class TestContracts:
    def test_create_contract(self):
        ...

    def test_list_contracts_pagination(self):
        ...

    def test_bulk_import_valid_csv(self):
        ...

    def test_bulk_import_invalid_records_quarantined(self):
        ...

    def test_soft_delete_sets_status(self):
        ...

class TestPayrolls:
    def test_partition_created_on_import(self):
        ...

    def test_bulk_import_with_validation(self):
        ...

    def test_search_by_contract_and_date(self):
        ...

class TestIngestion:
    def test_ingestion_job_tracking(self):
        ...

    def test_error_details_per_row(self):
        ...
```

**Minimum: 5 contract + 3 payroll + 2 ingestion = 10 tests**

---

## Architecture Notes

### Partitioning Is Automatic
When payroll records are imported for a contract, `ensure_partition()` creates the partition if it doesn't exist. No manual partition management. If a contract has no payroll records, no partition is created (no empty partitions).

### Soft Delete for Contracts
Deleting a contract sets `status = 'terminated'`. Payroll records and decisions are preserved (audit trail requirement). Hard delete is not available through the API.

### Bulk Import Is Async
Large imports (> 100 records) are processed asynchronously via Celery/Prefect. The API returns immediately with a job ID. The frontend polls for progress. Small imports (< 100 records) can be processed synchronously for better UX.

### CSV Validation Before Import
Every CSV import runs through Great Expectations before database write. Invalid rows are skipped (not loaded) but logged to `error_details`. The import continues with valid rows. This ensures partial imports are possible.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Partition creation fails | Low | High | `ensure_partition()` is idempotent (IF NOT EXISTS). Test against real PG |
| CSV parsing edge cases (encoding, delimiters) | Medium | Medium | Use Python csv.Sniffer for auto-detection. Validate with sample files |
| Bulk import too slow for 10K records | Medium | Medium | Batch INSERT (1000 rows/batch). Async processing. Progress tracking |
| Frontend complexity for contract management | Medium | Low | Start with list + detail + import. Advanced filtering is iterative |

---

## Command Reference

```bash
# Backend
cd backend
poetry run alembic upgrade head
poetry run pytest tests/unit/test_contracts.py tests/unit/test_payrolls.py tests/unit/test_ingestion.py -v

# Agent
cd agent
npm ci && npm run typecheck && npm test

# Frontend
cd frontend
npm ci && npm run typecheck && npm run build

# Manual test: create contract
curl -X POST http://localhost:8000/v1/contracts \
  -H 'Content-Type: application/json' \
  -d '{"contract_number":"GS-001","project_name":"Test","contractor_name":"Test Co","locality":"Boston, MA","start_date":"2025-01-01"}'
```

---

*Phase 6 document version: 2026-04-30*
*Blocked by: Phase 4 (Parquet archive) and Phase 5 (connectors) — builds on their infrastructure*
