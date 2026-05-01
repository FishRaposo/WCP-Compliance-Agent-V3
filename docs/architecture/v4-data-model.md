# V4 Data Model & Schema

**Database schema for V4 enterprise data platform — contracts, payrolls, ingestion, analytics, events.**

---

## Overview

V4 adds new tables to the same PostgreSQL 16 database that V3 uses. V3 application behavior remains unchanged and V4 tables are owned exclusively by V4 modules. A V4 Alembic migration may add a nullable `contract_id` compatibility column to V3's `decisions` table, but V3 remains the only writer of decision records and the deterministic validation pipeline is not modified.

### Design Principles

1. **V3 tables are read-only for V4.** V4 never writes to `decisions`, `audit_events`, `dbwd_rates`, `jobs`, or `users`; optional nullable compatibility columns are migration-only extensions.
2. **V4 tables are owned by V4.** V3 never accesses `contracts`, `payroll_records`, `ingestion_jobs`, or `connector_configs`.
3. **One database, clear ownership.** No separate database instances. Ownership is enforced at the application layer, not through database permissions.
4. **Partitioning for scale.** `payroll_records` is partitioned by `contract_id` (list partitioning) to keep queries fast with millions of rows.
5. **Parquet for archive.** Historical analytical data is archived to Parquet files and read by DuckDB.

---

## Migration Strategy

### Migration 006: V4 Foundation

```python
# backend/migrations/versions/006_v4_foundation.py

"""
V4 Data Platform: contracts, payroll_records, ingestion_jobs, connector_configs.
Adds contract_id FK to existing decisions table.
"""

def upgrade():
    # 1. Add contract_id to decisions (nullable — backfill later)
    op.add_column('decisions', sa.Column('contract_id', sa.String(), nullable=True))
    op.create_foreign_key('fk_decisions_contract', 'decisions', 'contracts', ['contract_id'], ['id'])
    op.create_index('ix_decisions_contract_id', 'decisions', ['contract_id'])

    # 2. Create contracts table
    op.create_table('contracts', ...)

    # 3. Create payroll_records table (partitioned)
    op.execute("CREATE TABLE payroll_records (...) PARTITION BY LIST (contract_id)")

    # 4. Create ingestion_jobs table
    op.create_table('ingestion_jobs', ...)

    # 5. Create connector_configs table
    op.create_table('connector_configs', ...)
```

### Migration 007: V4 Analytics (after DuckDB integration)

```python
# backend/migrations/versions/007_v4_analytics.py

"""
V4 Analytics: materialized views for DuckDB, indexes for cross-contract queries.
"""

def upgrade():
    # Materialized view for DuckDB to scan
    op.execute("""
        CREATE MATERIALIZED VIEW mv_decision_analytics AS
        SELECT
            d.id,
            d.verdict,
            d.trust_score,
            d.trust_band,
            d.violation_count,
            d.cost_usd,
            d.latency_ms,
            d.created_at,
            d.contract_id,
            COALESCE(c.contractor_name, 'unknown') as contractor_name,
            COALESCE(c.project_name, 'unknown') as project_name
        FROM decisions d
        LEFT JOIN contracts c ON d.contract_id = c.id
    """)

    op.execute("CREATE INDEX ix_mv_decision_created ON mv_decision_analytics (created_at)")
    op.execute("CREATE INDEX ix_mv_decision_contract ON mv_decision_analytics (contract_id)")
```

---

## V3 Tables (Unchanged, V4 Reads Only)

### `decisions` — V3 Core (optional V4 compatibility column)

```sql
-- Existing V3 columns (unchanged)
CREATE TABLE decisions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id          TEXT UNIQUE NOT NULL,
    verdict         TEXT NOT NULL,          -- 'Approved' | 'Revise' | 'Rejected' | 'Pending Human Review'
    trust_score     FLOAT NOT NULL,         -- 0.0 - 1.0
    trust_band      TEXT NOT NULL,          -- 'auto' | 'flag' | 'human'
    requires_human_review BOOLEAN NOT NULL DEFAULT FALSE,
    violation_count INTEGER NOT NULL DEFAULT 0,
    warning_count   INTEGER NOT NULL DEFAULT 0,
    reasoning_summary TEXT,
    citations       JSONB DEFAULT '[]',
    cost_usd        FLOAT,
    latency_ms      INTEGER,
    phoenix_trace_id TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- V4 addition (nullable until backfilled)
    contract_id     TEXT REFERENCES contracts(id)
);

-- Existing V3 indexes (unchanged)
CREATE INDEX ix_decisions_created_at ON decisions (created_at);
CREATE INDEX ix_decisions_trust_band ON decisions (trust_band);
CREATE INDEX ix_decisions_verdict ON decisions (verdict);

-- V4 new indexes
CREATE INDEX ix_decisions_contract_id ON decisions (contract_id);
CREATE INDEX ix_decisions_contract_created ON decisions (contract_id, created_at);
```

### `audit_events` — V3 Core (V4 reads only)

```sql
-- Unchanged from V3
CREATE TABLE audit_events (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id                TEXT NOT NULL,
    event_type            TEXT NOT NULL,
    actor                 TEXT,
    payload               JSONB DEFAULT '{}',
    regulation_references TEXT[] DEFAULT '{}',
    trace_id              TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_audit_events_job_id ON audit_events (job_id);
CREATE INDEX ix_audit_events_created ON audit_events (created_at);
```

### `dbwd_rates` — V3 Core (V4 reads only)

```sql
-- Unchanged from V3
CREATE TABLE dbwd_rates (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade                     TEXT NOT NULL,
    locality                  TEXT NOT NULL,
    rate                      FLOAT NOT NULL,
    fringe                    FLOAT NOT NULL,
    effective_date            DATE NOT NULL,
    wage_determination_number TEXT,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_dbwd_trade_locality ON dbwd_rates (trade, locality);
```

---

## V4 Tables (New)

### `contracts` — Contract Management

```sql
CREATE TABLE contracts (
    id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    contract_number     TEXT UNIQUE NOT NULL,           -- Federal contract number
    project_name        TEXT NOT NULL,                   -- Human-readable project name
    contractor_name     TEXT NOT NULL,                   -- Prime contractor name
    contractor_ein      TEXT,                            -- Employer Identification Number
    agency              TEXT,                            -- Federal agency (e.g., "GSA", "DoD")
    locality            TEXT NOT NULL,                   -- Project location
    start_date          DATE NOT NULL,
    end_date            DATE,
    total_value         NUMERIC(14, 2),                  -- Total contract value in USD
    status              TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'completed' | 'terminated' | 'suspended'
    source              TEXT NOT NULL DEFAULT 'manual',  -- 'manual' | 'sftp' | 'api' | 'database'
    source_reference    TEXT,                            -- Reference ID from source system
    metadata            JSONB DEFAULT '{}',              -- Extensible metadata
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_contracts_status ON contracts (status);
CREATE INDEX ix_contracts_contractor ON contracts (contractor_name);
CREATE INDEX ix_contracts_dates ON contracts (start_date, end_date);
CREATE INDEX ix_contracts_locality ON contracts (locality);
CREATE INDEX ix_contracts_source ON contracts (source);
```

**SQLAlchemy Model:**

```python
# backend/src/wcp_backend/contracts/models.py
from sqlalchemy import Column, String, Text, Date, Numeric, DateTime, Index
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import DeclarativeBase
import uuid

class Contract(DeclarativeBase):
    __tablename__ = "contracts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    contract_number = Column(String, unique=True, nullable=False)
    project_name = Column(Text, nullable=False)
    contractor_name = Column(Text, nullable=False)
    contractor_ein = Column(String)
    agency = Column(String)
    locality = Column(Text, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date)
    total_value = Column(Numeric(14, 2))
    status = Column(String, nullable=False, default="active")
    source = Column(String, nullable=False, default="manual")
    source_reference = Column(String)
    metadata = Column(JSONB, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
```

---

### `payroll_records` — Payroll Database (Partitioned)

```sql
-- Partitioned parent table
CREATE TABLE payroll_records (
    id                  UUID NOT NULL,
    contract_id         TEXT NOT NULL REFERENCES contracts(id),
    employee_name       TEXT NOT NULL,
    employee_id_hash    TEXT,                             -- Hashed identifier (privacy)
    trade_code          TEXT NOT NULL,                    -- e.g. "ELEC", "PLMB"
    locality_code       TEXT NOT NULL,
    week_ending         DATE NOT NULL,
    hours_monday        NUMERIC(4, 1),
    hours_tuesday       NUMERIC(4, 1),
    hours_wednesday     NUMERIC(4, 1),
    hours_thursday      NUMERIC(4, 1),
    hours_friday        NUMERIC(4, 1),
    hours_saturday      NUMERIC(4, 1),
    hours_sunday        NUMERIC(4, 1),
    total_hours         NUMERIC(5, 1) NOT NULL,
    hourly_rate         NUMERIC(8, 2) NOT NULL,
    gross_pay           NUMERIC(10, 2) NOT NULL,
    fringe_rate         NUMERIC(8, 2),
    fringe_total        NUMERIC(10, 2),
    overtime_hours      NUMERIC(5, 1) DEFAULT 0,
    overtime_pay        NUMERIC(10, 2) DEFAULT 0,
    decision_id         TEXT REFERENCES decisions(job_id), -- Link to V3 analysis
    source_file         TEXT,                             -- Original file name
    ingestion_job_id    TEXT REFERENCES ingestion_jobs(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (id, contract_id)
) PARTITION BY LIST (contract_id);

-- Per-contract partitions created dynamically
-- Example: CREATE TABLE payroll_records_contract_abc PARTITION OF payroll_records
--          FOR VALUES IN ('abc');

-- Indexes (created on each partition automatically)
CREATE INDEX ix_payroll_week_ending ON payroll_records (week_ending);
CREATE INDEX ix_payroll_trade ON payroll_records (trade_code);
CREATE INDEX ix_payroll_employee ON payroll_records (employee_name);
CREATE INDEX ix_payroll_decision ON payroll_records (decision_id);
CREATE INDEX ix_payroll_contract_week ON payroll_records (contract_id, week_ending);
```

**Partition Management:**

```python
# backend/src/wcp_backend/payrolls/service.py
async def create_partition(contract_id: str) -> None:
    partition_name = f"payroll_records_contract_{contract_id.replace('-', '_')}"
    await conn.execute(f"""
        CREATE TABLE IF NOT EXISTS {partition_name}
        PARTITION OF payroll_records
        FOR VALUES IN ('{contract_id}')
    """)
```

**SQLAlchemy Model:**

```python
# backend/src/wcp_backend/payrolls/models.py
from sqlalchemy import Column, String, Text, Numeric, Date, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import DeclarativeBase
import uuid

class PayrollRecord(DeclarativeBase):
    __tablename__ = "payroll_records"

    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    contract_id = Column(String, ForeignKey("contracts.id"), primary_key=True)
    employee_name = Column(Text, nullable=False)
    employee_id_hash = Column(String)
    trade_code = Column(Text, nullable=False)
    locality_code = Column(Text, nullable=False)
    week_ending = Column(Date, nullable=False)
    hours_monday = Column(Numeric(4, 1))
    hours_tuesday = Column(Numeric(4, 1))
    hours_wednesday = Column(Numeric(4, 1))
    hours_thursday = Column(Numeric(4, 1))
    hours_friday = Column(Numeric(4, 1))
    hours_saturday = Column(Numeric(4, 1))
    hours_sunday = Column(Numeric(4, 1))
    total_hours = Column(Numeric(5, 1), nullable=False)
    hourly_rate = Column(Numeric(8, 2), nullable=False)
    gross_pay = Column(Numeric(10, 2), nullable=False)
    fringe_rate = Column(Numeric(8, 2))
    fringe_total = Column(Numeric(10, 2))
    overtime_hours = Column(Numeric(5, 1), default=0)
    overtime_pay = Column(Numeric(10, 2), default=0)
    decision_id = Column(String, ForeignKey("decisions.job_id"))
    source_file = Column(String)
    ingestion_job_id = Column(String, ForeignKey("ingestion_jobs.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

---

### `ingestion_jobs` — ETL Job Tracking

```sql
CREATE TABLE ingestion_jobs (
    id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    type                TEXT NOT NULL,                    -- 'contract_import' | 'payroll_import' | 'dbwd_refresh' | 'decision_export'
    status              TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'processing' | 'completed' | 'failed' | 'partial'
    source_type         TEXT NOT NULL,                    -- 'csv' | 'pdf' | 'api' | 'sftp' | 'database' | 'scheduled'
    source_reference    TEXT,                             -- File path, API endpoint, or schedule name
    contract_id         TEXT REFERENCES contracts(id),    -- Target contract (for payroll imports)
    total_records       INTEGER DEFAULT 0,
    processed_records   INTEGER DEFAULT 0,
    failed_records      INTEGER DEFAULT 0,
    error_details       JSONB DEFAULT '[]',               -- Per-record errors: [{row: 5, error: "missing trade_code"}]
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_ingestion_status ON ingestion_jobs (status);
CREATE INDEX ix_ingestion_type ON ingestion_jobs (type);
CREATE INDEX ix_ingestion_contract ON ingestion_jobs (contract_id);
CREATE INDEX ix_ingestion_created ON ingestion_jobs (created_at);
```

---

### `connector_configs` — Enterprise Connector Configuration

```sql
CREATE TABLE connector_configs (
    id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name                TEXT UNIQUE NOT NULL,              -- Human-readable name
    type                TEXT NOT NULL,                     -- 'sftp' | 'api' | 'database'
    connection_config   JSONB NOT NULL,                   -- Type-specific config (host, port, credentials ref)
    schedule_cron       TEXT,                              -- Cron expression for scheduled sync
    last_sync_at        TIMESTAMPTZ,
    last_sync_status    TEXT,                              -- 'success' | 'partial' | 'failed'
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_connector_type ON connector_configs (type);
CREATE INDEX ix_connector_active ON connector_configs (is_active);
```

**Connection config examples:**

```json
// SFTP connector
{
  "host": "sftp.contractor.com",
  "port": 22,
  "username": "wcp_sync",
  "key_vault_ref": "azure_key_vault://sftp-wcp-key",
  "remote_path": "/outgoing/payrolls/",
  "file_pattern": "*.csv"
}

// API connector
{
  "base_url": "https://erp.contractor.com/api/v1",
  "auth_type": "oauth2",
  "token_url": "https://erp.contractor.com/oauth/token",
  "client_id_ref": "secret://erp-client-id",
  "client_secret_ref": "secret://erp-client-secret"
}

// Database connector
{
  "engine": "postgresql",
  "host": "read-replica.contractor.com",
  "port": 5432,
  "database": "payroll_prod",
  "username_ref": "secret://db-readonly-user",
  "password_ref": "secret://db-readonly-pass",
  "query": "SELECT * FROM payroll_weekly WHERE week_ending > :last_sync"
}
```

---

## Parquet Archive Schema

Decisions are archived monthly to Parquet files for long-term analytical storage:

```
data/archive/decisions/
├── 2025-01.parquet
├── 2025-02.parquet
└── ...
```

**Parquet schema (PyArrow):**

```python
import pyarrow as pa
import pyarrow.parquet as pq

decision_schema = pa.schema([
    pa.field("id", pa.string(), nullable=False),
    pa.field("job_id", pa.string(), nullable=False),
    pa.field("verdict", pa.string(), nullable=False),
    pa.field("trust_score", pa.float64(), nullable=False),
    pa.field("trust_band", pa.string(), nullable=False),
    pa.field("violation_count", pa.int32(), nullable=False),
    pa.field("warning_count", pa.int32(), nullable=False),
    pa.field("reasoning_summary", pa.string(), nullable=True),
    pa.field("citations", pa.string(), nullable=True),          # JSON-encoded array
    pa.field("cost_usd", pa.float64(), nullable=True),
    pa.field("latency_ms", pa.int32(), nullable=True),
    pa.field("phoenix_trace_id", pa.string(), nullable=True),
    pa.field("contract_id", pa.string(), nullable=True),
    pa.field("contractor_name", pa.string(), nullable=True),
    pa.field("project_name", pa.string(), nullable=True),
    pa.field("created_at", pa.timestamp("us", tz="UTC"), nullable=False),
])
```

**Write with MD5 verification:**

```python
# backend/src/wcp_backend/storage/parquet_writer.py
import pyarrow as pa
import pyarrow.parquet as pq
import hashlib

async def export_monthly_decisions(year: int, month: int, records: list[dict]) -> str:
    table = pa.Table.from_pylist(records, schema=decision_schema)
    path = f"data/archive/decisions/{year}-{month:02d}.parquet"
    pq.write_table(table, path, compression="zstd")

    with open(path, "rb") as f:
        md5 = hashlib.md5(f.read()).hexdigest()

    return path, md5
```

---

## Redis Stream Message Schemas

### `decisions:stream` — Decision Events

Published by `events/producer.py` on every decision persist. Consumed by agent gateway (SSE) and DuckDB analytics rollup.

```python
# backend/src/wcp_backend/events/schemas.py
from pydantic import BaseModel
from datetime import datetime

class DecisionEvent(BaseModel):
    decision_id: str
    contract_id: str | None = None
    status: str                      # 'Approved' | 'Revise' | 'Rejected' | 'Pending Human Review'
    trust_score: float               # 0.0 - 1.0
    trust_band: str                  # 'auto' | 'flag' | 'human'
    trade: str
    locality: str
    violation_count: int
    model_used: str                  # 'gpt-4o' | 'claude-sonnet-3-5' | 'llama3.2'
    cost_usd: float
    latency_ms: int
    timestamp: datetime
```

**Redis XADD:**

```python
# backend/src/wcp_backend/events/producer.py
import json
import redis.asyncio as redis
from .schemas import DecisionEvent

async def emit_decision_event(event: DecisionEvent, redis_client: redis.Redis) -> None:
    await redis_client.xadd(
        "decisions:stream",
        {"data": event.model_dump_json()},
        maxlen=100000  # Keep last 100K events
    )
```

### `ingestion:stream` — Ingestion Job Events (V4.1)

```python
class IngestionEvent(BaseModel):
    job_id: str
    type: str                        # 'contract_import' | 'payroll_import'
    status: str                      # 'started' | 'completed' | 'failed' | 'partial'
    records_processed: int
    records_failed: int
    duration_seconds: float
    timestamp: datetime
```

---

## DuckDB View Registration

DuckDB reads both PostgreSQL and Parquet. Views are registered at startup:

```python
# backend/src/wcp_backend/storage/duckdb_init.py
import duckdb

def init_duckdb(pg_connection_string: str, parquet_path: str = "data/archive/decisions") -> duckdb.DuckDBPyConnection:
    con = duckdb.connect()

    # Register PostgreSQL source
    con.execute(f"""
        INSTALL postgres;
        LOAD postgres;
        CALL postgres_attach('{pg_connection_string}');
    """)

    # Create view over live decisions (from PostgreSQL)
    con.execute("""
        CREATE VIEW v_decisions AS
        SELECT * FROM postgres_scan('public', 'decisions')
    """)

    # Create view over Parquet archive
    con.execute(f"""
        CREATE VIEW v_decisions_archive AS
        SELECT * FROM read_parquet('{parquet_path}/*.parquet')
    """)

    # Create unified view (live + archived)
    con.execute("""
        CREATE VIEW v_all_decisions AS
        SELECT * FROM v_decisions
        UNION ALL
        SELECT * FROM v_decisions_archive
    """)

    # Register contracts view
    con.execute("""
        CREATE VIEW v_contracts AS
        SELECT * FROM postgres_scan('public', 'contracts')
    """)

    return con
```

---

## Partitioning Strategy

### Why List Partitioning by `contract_id`

| Alternative | Why Not |
|---|---|
| **Range by `week_ending`** | Queries are contract-scoped first, date-scoped second. Contract partitioning prunes more effectively |
| **Hash by `id`** | Even distribution but loses contract locality. Cross-partition queries for single contract |
| **List by `contract_id`** | Best fit: most queries filter by contract. Each partition holds one contract's payroll history. Pruning is automatic |

### Partition Lifecycle

```python
# Partition is created when a contract is first imported into the system
async def ensure_partition(contract_id: str, conn) -> None:
    safe_name = contract_id.replace("-", "_")
    partition_name = f"payroll_records_contract_{safe_name}"
    await conn.execute(f"""
        CREATE TABLE IF NOT EXISTS {partition_name}
        PARTITION OF payroll_records
        FOR VALUES IN ('{contract_id}')
    """)
```

### Partition Pruning Example

```sql
-- This query only scans the partition for contract 'abc'
SELECT * FROM payroll_records
WHERE contract_id = 'abc'
  AND week_ending BETWEEN '2025-01-01' AND '2025-03-31'
ORDER BY week_ending;
```

---

## Schema Ownership Summary

| Table | Owner | Created By | Written By | Read By |
|---|---|---|---|---|
| `decisions` | V3 | Migration 001 | V3 `services/audit.py` | V3 API, V4 analytics (DuckDB) |
| `audit_events` | V3 | Migration 001 | V3 `services/audit.py` | V3 API, V4 analytics (DuckDB) |
| `dbwd_rates` | V3 | Migration 001 | V3 seed scripts | V3 pipeline, V4 analytics (DuckDB) |
| `jobs` | V3 | Migration 003 | V3 `services/job_queue.py` | V3 API |
| `users` | V3 | Migration 005 | V3 `api/auth.py` | V3 auth |
| `regulation_chunks` | V3 | Migration 002 | V3 seed scripts | V3 retrieval |
| `contracts` | **V4** | Migration 006 | V4 `contracts/service.py` | V4 API, V4 analytics (DuckDB) |
| `payroll_records` | **V4** | Migration 006 | V4 `payrolls/service.py` | V4 API, V4 analytics (DuckDB) |
| `ingestion_jobs` | **V4** | Migration 006 | V4 `ingestion/processor.py` | V4 API |
| `connector_configs` | **V4** | Migration 006 | V4 `connectors/registry.py` | V4 connectors |
| `mv_decision_analytics` | **V4** | Migration 007 | V4 refresh (DuckDB) | V4 analytics (DuckDB) |

---

## Entity Relationship Diagram

```
contracts (V4)
├── id (PK)
├── contract_number (UNIQUE)
├── contractor_name
├── project_name
├── start_date / end_date
└── status
    │
    ├── 1:N ──► payroll_records (V4, partitioned by contract_id)
    │           ├── id (PK, with contract_id)
    │           ├── employee_name
    │           ├── trade_code
    │           ├── week_ending
    │           ├── total_hours / hourly_rate / gross_pay
    │           ├── decision_id (FK → decisions.job_id)
    │           └── ingestion_job_id (FK → ingestion_jobs.id)
    │
    └── 1:N ──► decisions (V3, contract_id FK added)
                ├── id (PK)
                ├── job_id (UNIQUE)
                ├── verdict / trust_score / trust_band
                ├── contract_id (FK → contracts.id)
                └── created_at

ingestion_jobs (V4)
├── id (PK)
├── type / status / source_type
├── contract_id (FK → contracts.id)
├── total_records / processed_records / failed_records
└── error_details (JSONB)

connector_configs (V4)
├── id (PK)
├── name (UNIQUE) / type
├── connection_config (JSONB)
├── schedule_cron
└── last_sync_at / last_sync_status
```

---

## Related Documentation

- [V4 Data Platform Architecture](v4-data-platform.md) — Module responsibilities and system design
- [V4 Data Flows](v4-data-flows.md) — How data moves through these tables
- [V4 API Contract](../v4-api-contract.md) — Endpoints that read/write these tables
- [V3/V4 Boundary](../planning/V3_V4_BOUNDARY.md) — Shared database ownership contract
- [Graph Model](graph-model.md) — V3 entity relationship model

---

*Generated: 2026-04-30*
