# V4 Remaining Build Items

**Purpose:** Track what still needs to be built for V4 to move from portfolio-ready MVP to a fully production-proven data platform.

V4 currently has working contracts/payroll APIs, ingestion job tracking, analytics pages, Redis Streams/SSE plumbing, Prefect-compatible flows, PyArrow Parquet writing, and V4 documentation. The items below are the remaining implementation gaps, grouped by subsystem.

---

## 1. Native Great Expectations Runtime

**Current state**
- `backend/src/wcp_backend/quality/` performs real row-level validation and returns GE-compatible result shapes.
- Validation catches missing fields, bad dates, bad ranges, duplicates, and malformed payroll/contract/DBWD records.
- `great-expectations` is installed as a backend dependency.

**Still to build**
- Create native GX `DataContext` configuration for local/dev execution.
- Define actual GX suites for:
  - DBWD rates
  - Contracts
  - Payroll records
  - Connector payloads
- Run GX checkpoints from ingestion and Prefect flows.
- Persist validation artifacts or summary metadata for failed ingestion jobs.
- Add tests that assert GX catches invalid data through real GX APIs, not just custom validators.

**Done when**
- `poetry run python -c "from wcp_backend.quality.dbwd_expectations import validate_dbwd_rates; ..."` returns a native GX-compatible result.
- Ingestion jobs can store validation summaries and row-level failures from GX.
- Unit tests cover valid/invalid GX batches for DBWD, contracts, and payrolls.

---

## 2. Live SAM.gov DBWD Refresh

**Current state**
- `dbwd_refresh_flow` validates and upserts supplied DBWD rate records.
- Retry behavior and upsert semantics are implemented.
- The external fetch hook intentionally returns an empty batch when no rates are injected.

**Still to build**
- Implement SAM.gov wage determination fetch logic in `fetch_sam_gov_rates`.
- Normalize external payloads into the internal DBWD shape:
  - `trade`
  - `locality`
  - `rate`
  - `fringe`
  - `effective_date`
  - `wage_determination_number`
- Add pagination, timeout, API key, and retry handling.
- Add fixture-based tests for SAM.gov payload parsing.
- Add integration tests gated behind `SAM_GOV_API_KEY`.

**Done when**
- Running `dbwd_refresh_flow(sam_gov_api_key=...)` fetches real rates, validates them, and upserts into `dbwd_rates`.
- Bad upstream records are rejected or quarantined without aborting the entire refresh.

---

## 3. DuckDB as Primary Analytics Engine

**Current state**
- DuckDB dependency is installed.
- `DuckDBStore` can connect and register PostgreSQL/Parquet views.
- Analytics endpoints currently use SQLAlchemy/PostgreSQL aggregates for reliable API behavior.
- Parquet archive writer is real PyArrow Parquet.

**Still to build**
- Move `/v4/analytics/*` query execution to DuckDB for OLAP-first behavior.
- Register live PostgreSQL tables and Parquet archive views at application startup or analytics request time.
- Add fallback from DuckDB to PostgreSQL only when DuckDB is unavailable.
- Add query tests for:
  - live Postgres-only analytics
  - Parquet-only analytics
  - combined live + archive analytics
- Add performance smoke tests for large synthetic payroll/decision datasets.

**Done when**
- `/v4/analytics/overview`, `/decision-volume`, `/compliance`, `/wages`, and `/llm` prefer DuckDB-backed queries.
- Archived Parquet decisions appear in analytics results.
- Empty-data behavior remains stable and does not raise 500s.

---

## 4. Enterprise Connectors

**Current state**
- Connector framework files exist under `backend/src/wcp_backend/connectors/`.
- Registry and base connector abstractions provide the shape for SFTP, API, and database connectors.

**Still to build**
- Implement a real SFTP connector:
  - connect
  - list files
  - fetch CSV/PDF payloads
  - checkpoint processed files
- Implement a real REST API connector:
  - auth headers/token support
  - pagination
  - retry/backoff
  - payload normalization
- Implement a real database connector:
  - read-only connection config
  - query templates
  - row streaming
  - schema mapping
- Wire connector sync into Prefect flows and ingestion jobs.
- Add CRUD/API endpoints for connector configuration if the UI is expected to manage connectors.

**Done when**
- At least one connector can sync data into an ingestion job end to end.
- Connector failures are visible in ingestion job status and do not crash the worker process.
- Unit tests cover connector config validation and mocked syncs.

---

## 5. Full V4 Integration Tests

**Current state**
- Backend unit tests pass.
- Agent unit/integration tests pass.
- Frontend tests/build pass.
- Full infrastructure integration was not run in the finalization pass.

**Still to build**
- Add integration tests that run with PostgreSQL and Redis:
  - create contract
  - import payroll batch
  - create ingestion job
  - query analytics
  - emit Redis event
  - consume SSE event
- Add Parquet export integration test:
  - seed decisions
  - run monthly export
  - verify manifest
  - verify DuckDB can read exported file
- Add Prefect flow smoke tests in a test profile.
- Update `scripts/e2e-smoke.sh` to cover the V4 demo path.

**Done when**
- A single documented command can prove the V4 happy path against local infrastructure.
- CI or a documented local profile can run V4 integration tests without real OpenAI credentials.

---

## 6. Frontend Browser Verification

**Current state**
- Frontend typecheck, tests, lint, and production build pass.
- V4 pages exist for analytics, contracts, payrolls, and ingestion.
- Mock-mode tests cover key rendering paths.

**Still to build**
- Run browser QA with real or seeded local services:
  - `/contracts`
  - `/payrolls`
  - `/ingestion`
  - `/analytics/overview`
  - `/analytics/compliance`
  - `/analytics/wages`
  - `/analytics/llm`
- Verify CSV upload forms send the exact shape expected by backend routes.
- Verify SSE live feed receives real Redis events.
- Add Playwright or browser-use smoke coverage for the portfolio demo.

**Done when**
- Browser demo can be recorded without manual API patching or mock-only behavior.
- Upload, polling, analytics, and live feed all work in a fresh local run.

---

## 7. V4 Deployment and Operations

**Current state**
- Service-level build/test commands exist.
- V4 dependencies are declared.
- Existing deployment docs cover V3 service deployment.

**Still to build**
- Update Docker/Render/Vercel deployment docs for V4 runtime dependencies.
- Add Prefect deployment definitions and worker startup instructions.
- Add archive storage configuration for Parquet output.
- Add environment variable documentation for:
  - DuckDB database/archive paths
  - Prefect API/profile
  - connector secrets
  - SAM.gov API key
  - Redis Streams consumer config
- Add production-safe retention policies for Redis Streams and Parquet archives.

**Done when**
- A new maintainer can deploy V4 from docs without reverse-engineering service assumptions.
- Prefect jobs and archive paths are configured through environment variables.

---

## 8. Dependency and Security Cleanup

**Current state**
- Python/TypeScript verification passes.
- `npm audit` reports moderate vulnerabilities in existing JavaScript dependency trees.
- Force-upgrading was intentionally not done during finalization because it may introduce breaking changes.

**Still to build**
- Review `npm audit` output for agent and frontend.
- Apply non-breaking dependency updates first.
- Assess breaking upgrades separately with tests/builds.
- Add a documented dependency update cadence.
- Consider enabling Dependabot or Renovate for the three independent service directories.

**Done when**
- `npm audit` is clean or each remaining advisory has a documented risk acceptance.
- Dependency updates do not break service builds or tests.

---

## Suggested Build Order

1. Full V4 integration test harness.
2. DuckDB as the primary analytics path.
3. Native Great Expectations checkpoints.
4. Live SAM.gov refresh.
5. At least one real connector sync.
6. Browser demo verification.
7. Deployment/operations hardening.
8. Dependency audit cleanup.

This order proves the current platform first, then deepens individual infrastructure claims.
