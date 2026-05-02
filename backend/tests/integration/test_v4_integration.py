"""V4 integration test harness -- full happy-path tests with mocked infra.

Tests exercise real V4 module logic (schemas, validation, serialization,
Parquet I/O, DuckDB queries, connector registry) while mocking external
dependencies (PostgreSQL, Redis) so no real infrastructure is needed.

Run with:
    poetry run pytest tests/integration/test_v4_integration.py -v
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

import pytest

pytestmark = pytest.mark.integration


# ---------------------------------------------------------------------------
# 1. Contract CRUD
# ---------------------------------------------------------------------------


async def test_contract_crud():
    from wcp_backend.contracts.schemas import ContractCreate, ContractResponse, ContractUpdate

    create_data = ContractCreate(
        contract_number="GS-001-2026",
        project_name="Federal Building Renovation",
        contractor_name="Acme Construction",
        locality="Washington, DC",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
        total_value=Decimal("500000.00"),
    )
    assert create_data.contract_number == "GS-001-2026"
    assert create_data.source == "manual"

    update_data = ContractUpdate(
        project_name="Federal Building Renovation Phase 2",
        total_value=Decimal("750000.00"),
    )
    dumped = update_data.model_dump(exclude_unset=True)
    assert dumped["project_name"] == "Federal Building Renovation Phase 2"
    assert "contract_number" not in dumped

    response_dict = {
        "id": str(uuid.uuid4()),
        "contract_number": "GS-001-2026",
        "project_name": "Federal Building Renovation Phase 2",
        "contractor_name": "Acme Construction",
        "contractor_ein": None,
        "agency": None,
        "locality": "Washington, DC",
        "start_date": date(2026, 1, 1),
        "end_date": date(2026, 12, 31),
        "total_value": Decimal("750000.00"),
        "status": "active",
        "source": "manual",
        "source_reference": None,
        "metadata": {},
        "decision_count": 0,
        "payroll_record_count": 0,
        "latest_decision_at": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    response = ContractResponse.model_validate(response_dict)
    assert response.id
    assert response.total_value == Decimal("750000.00")
    assert response.status == "active"


# ---------------------------------------------------------------------------
# 2. Payroll import and query
# ---------------------------------------------------------------------------


async def test_payroll_import_and_query():
    from wcp_backend.payrolls.schemas import (
        PayrollBulkImportRequest,
        PayrollRecordCreate,
        PayrollRecordResponse,
    )

    record = PayrollRecordCreate(
        employee_name="John Doe",
        trade_code="ELEC",
        locality_code="DC",
        week_ending=date(2026, 4, 17),
        total_hours=Decimal("40.0"),
        hourly_rate=Decimal("51.69"),
        gross_pay=Decimal("2067.60"),
    )
    assert record.employee_name == "John Doe"
    assert record.total_hours == Decimal("40.0")

    import_request = PayrollBulkImportRequest(
        contract_id=str(uuid.uuid4()),
        records=[record],
        source="sftp",
        source_reference="payroll_week17.csv",
    )
    assert len(import_request.records) == 1
    assert import_request.source == "sftp"

    response_dict = {
        "id": str(uuid.uuid4()),
        "contract_id": import_request.contract_id,
        "employee_name": "John Doe",
        "employee_id_hash": None,
        "trade_code": "ELEC",
        "locality_code": "DC",
        "week_ending": date(2026, 4, 17),
        "hours_monday": None,
        "hours_tuesday": None,
        "hours_wednesday": None,
        "hours_thursday": None,
        "hours_friday": None,
        "hours_saturday": None,
        "hours_sunday": None,
        "total_hours": Decimal("40.0"),
        "hourly_rate": Decimal("51.69"),
        "gross_pay": Decimal("2067.60"),
        "fringe_rate": None,
        "fringe_total": None,
        "overtime_hours": Decimal("0"),
        "overtime_pay": Decimal("0"),
        "decision_id": None,
        "source_file": "payroll_week17.csv",
        "ingestion_job_id": str(uuid.uuid4()),
        "created_at": datetime.now(timezone.utc),
        "decision_verdict": None,
        "decision_trust_score": None,
    }
    response = PayrollRecordResponse.model_validate(response_dict)
    assert response.employee_name == "John Doe"
    assert response.contract_id == import_request.contract_id


# ---------------------------------------------------------------------------
# 3. Ingestion job lifecycle
# ---------------------------------------------------------------------------


async def test_ingestion_job_lifecycle():
    from wcp_backend.ingestion.schemas import IngestionJobCreate, IngestionJobResponse

    create_data = IngestionJobCreate(
        type="payroll_import",
        source_type="sftp",
        source_reference="payroll_batch_001.csv",
        contract_id=str(uuid.uuid4()),
        total_records=50,
    )
    assert create_data.type == "payroll_import"
    assert create_data.total_records == 50

    pending_response_dict = {
        "job_id": str(uuid.uuid4()),
        "type": "payroll_import",
        "status": "pending",
        "source_type": "sftp",
        "source_reference": "payroll_batch_001.csv",
        "contract_id": create_data.contract_id,
        "total_records": 50,
        "processed_records": 0,
        "failed_records": 0,
        "error_details": [],
        "started_at": None,
        "completed_at": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    pending = IngestionJobResponse.model_validate(pending_response_dict)
    assert pending.status == "pending"
    assert pending.started_at is None

    processing_response_dict = {**pending_response_dict, "status": "processing", "started_at": datetime.now(timezone.utc)}
    processing = IngestionJobResponse.model_validate(processing_response_dict)
    assert processing.status == "processing"
    assert processing.started_at is not None

    completed_response_dict = {
        **processing_response_dict,
        "status": "completed",
        "processed_records": 50,
        "completed_at": datetime.now(timezone.utc),
    }
    completed = IngestionJobResponse.model_validate(completed_response_dict)
    assert completed.status == "completed"
    assert completed.processed_records == 50
    assert completed.completed_at is not None


# ---------------------------------------------------------------------------
# 4. Quality validation catches bad data
# ---------------------------------------------------------------------------


def test_quality_validation_catches_bad_data():
    from wcp_backend.quality import validate_payroll_records

    bad_records = [
        {
            "employee_name": "",
            "trade_code": "ELEC",
            "week_ending": "not-a-date",
            "total_hours": -5,
            "hourly_rate": -10,
            "gross_pay": -100,
        },
        {
            "employee_name": "Jane Doe",
            "trade_code": "ELEC",
            "week_ending": "2026-04-17",
            "total_hours": 200,
            "hourly_rate": 50,
            "gross_pay": 10000,
        },
    ]
    result = validate_payroll_records(bad_records)
    assert not result.success
    assert result.failed_count >= 1
    assert len(result.errors) >= 1


# ---------------------------------------------------------------------------
# 5. Quality validation passes good data
# ---------------------------------------------------------------------------


def test_quality_validation_passes_good_data():
    from wcp_backend.quality import validate_payroll_records

    good_records = [
        {
            "employee_name": "John Doe",
            "trade_code": "ELEC",
            "week_ending": "2026-04-17",
            "total_hours": 40,
            "hourly_rate": 51.69,
            "gross_pay": 2067.60,
        },
    ]
    result = validate_payroll_records(good_records)
    assert result.success
    assert result.failed_count == 0
    assert len(result.errors) == 0


# ---------------------------------------------------------------------------
# 6. Event serialization round-trip
# ---------------------------------------------------------------------------


def test_event_serialization():
    from wcp_backend.events.schemas import DecisionEvent

    event = DecisionEvent(
        decision_id=str(uuid.uuid4()),
        contract_id=str(uuid.uuid4()),
        verdict="approved",
        trust_score=0.92,
        trust_band="high",
        requires_human_review=False,
        violation_count=0,
        warning_count=0,
        cost_usd=0.003,
        latency_ms=1200,
        trade_code="ELEC",
        locality="Washington, DC",
    )

    redis_payload = event.to_redis_payload()
    assert "event" in redis_payload
    assert isinstance(redis_payload["event"], str)

    parsed = json.loads(redis_payload["event"])
    assert parsed["verdict"] == "approved"
    assert parsed["trust_score"] == 0.92
    assert parsed["decision_id"] == event.decision_id

    reconstructed = DecisionEvent.model_validate_json(redis_payload["event"])
    assert reconstructed.decision_id == event.decision_id
    assert reconstructed.verdict == event.verdict
    assert reconstructed.trust_score == event.trust_score
    assert reconstructed.trade_code == "ELEC"


# ---------------------------------------------------------------------------
# 7. Parquet export round-trip
# ---------------------------------------------------------------------------


def test_parquet_export_round_trip(tmp_path: Any):
    from wcp_backend.storage.parquet_writer import ParquetWriter

    records = [
        {
            "decision_id": str(uuid.uuid4()),
            "verdict": "approved",
            "trust_score": 0.95,
            "trade_code": "ELEC",
        },
        {
            "decision_id": str(uuid.uuid4()),
            "verdict": "revise",
            "trust_score": 0.55,
            "trade_code": "CARP",
        },
    ]

    writer = ParquetWriter(output_dir=tmp_path)
    result = writer.write(records, "test_export.parquet")
    assert result["records_written"] == 2
    assert result["md5"] is not None

    import pyarrow.parquet as pq

    table = pq.read_table(tmp_path / "test_export.parquet")
    assert table.num_rows == 2
    assert "decision_id" in table.column_names
    assert table.column("verdict").to_pylist() == ["approved", "revise"]
    assert table.column("trust_score").to_pylist() == [0.95, 0.55]


# ---------------------------------------------------------------------------
# 8. DuckDB store lifecycle
# ---------------------------------------------------------------------------


def test_duckdb_store_lifecycle(tmp_path: Any):
    import pyarrow as pa
    import pyarrow.parquet as pq

    from wcp_backend.analytics.duckdb_store import DuckDBStore

    test_data = pa.table({
        "id": [1, 2, 3],
        "trade": ["ELEC", "CARP", "PLUMB"],
        "rate": [51.69, 45.00, 48.50],
    })
    parquet_file = tmp_path / "rates.parquet"
    pq.write_table(test_data, parquet_file)

    store = DuckDBStore(database_path=":memory:")
    assert not store.is_connected

    store.connect()
    assert store.is_connected

    store.register_parquet_view("rates_view", str(parquet_file))
    rows = store.execute_query("SELECT * FROM rates_view ORDER BY id")
    assert len(rows) == 3
    assert rows[0]["trade"] == "ELEC"
    assert float(rows[0]["rate"]) == pytest.approx(51.69)

    agg = store.execute_query("SELECT COUNT(*) as cnt, AVG(rate) as avg_rate FROM rates_view")
    assert agg[0]["cnt"] == 3

    store.close()
    assert not store.is_connected


# ---------------------------------------------------------------------------
# 9. Connector registry lifecycle
# ---------------------------------------------------------------------------


def test_connector_registry_lifecycle():
    from wcp_backend.connectors.registry import ConnectorRegistry

    registry = ConnectorRegistry()
    assert registry.list_connectors() == []

    config = {
        "name": "test-sftp",
        "type": "sftp",
        "connection_config": {
            "host": "sftp.example.com",
            "port": 22,
            "username": "testuser",
            "password": "testpass",
            "remote_dir": "/uploads",
            "file_pattern": "*.csv",
        },
        "schedule_cron": "0 */6 * * *",
        "is_active": True,
    }
    registry.register(config)
    assert len(registry.list_connectors()) == 1

    retrieved = registry.get("test-sftp")
    assert retrieved is not None
    assert retrieved["connection_config"]["host"] == "sftp.example.com"

    sftp_connectors = registry.list_connectors(connector_type="sftp")
    assert len(sftp_connectors) == 1

    active = registry.list_active()
    assert len(active) == 1

    registry.unregister("test-sftp")
    assert registry.list_connectors() == []
    assert registry.get("test-sftp") is None


# ---------------------------------------------------------------------------
# 10. DBWD refresh flow with injected rates
# ---------------------------------------------------------------------------


async def test_dbwd_refresh_flow_with_injected_rates():
    from wcp_backend.quality.dbwd_expectations import validate_dbwd_rates

    good_rates = [
        {
            "rate_key": "ELEC-DC-2026",
            "trade_code": "ELEC",
            "locality_code": "DC",
            "wage": 51.69,
            "fringe": 34.63,
            "effective_date": "2026-01-01",
            "wage_determination_number": "WD 2026-0001",
        },
        {
            "rate_key": "CARP-DC-2026",
            "trade_code": "CARP",
            "locality_code": "DC",
            "wage": 45.00,
            "fringe": 25.00,
            "effective_date": "2026-01-01",
            "wage_determination_number": "WD 2026-0002",
        },
    ]

    bad_rates = [
        {
            "rate_key": "BAD-DC-2026",
            "trade_code": "BADTRADE",
            "locality_code": "DC",
            "wage": -10,
            "effective_date": "not-a-date",
        },
    ]

    good_result = validate_dbwd_rates(good_rates)
    assert good_result.success
    assert good_result.failed_count == 0

    bad_result = validate_dbwd_rates(bad_rates)
    assert not bad_result.success
    assert bad_result.failed_count >= 1
    assert len(bad_result.errors) >= 1

    from wcp_backend.pipelines.dbwd_refresh import validate_rates

    valid, failed = await validate_rates(good_rates + bad_rates)
    assert len(valid) == 2
    assert len(failed) >= 1


# ---------------------------------------------------------------------------
# 11. Checkpoint runner with artifact persistence
# ---------------------------------------------------------------------------


def test_checkpoint_runner_persists_artifacts(tmp_path: Any):
    from wcp_backend.quality import CheckpointRunner

    runner = CheckpointRunner(artifact_store_path=str(tmp_path))

    good_records = [
        {
            "employee_name": "John Doe",
            "trade_code": "ELEC",
            "week_ending": "2026-04-17",
            "total_hours": 40,
            "hourly_rate": 51.69,
            "gross_pay": 2067.60,
        },
    ]

    artifact = runner.run_checkpoint(
        "payroll_validation",
        good_records,
        [],
        job_id="test_job_001",
    )

    assert artifact.success
    assert artifact.artifact_id == "test_job_001"
    assert artifact.artifact_path is not None
    assert os.path.exists(artifact.artifact_path)

    # Test loading artifact
    loaded = runner.load_artifact("test_job_001")
    assert loaded is not None
    assert loaded.success == artifact.success
    assert loaded.suite_name == "payroll_validation"

    # Test listing artifacts
    artifacts = runner.list_artifacts()
    assert len(artifacts) == 1


# ---------------------------------------------------------------------------
# 12. Failed checkpoint quarantine workflow
# ---------------------------------------------------------------------------


def test_failed_checkpoint_quarantine(tmp_path: Any):
    from wcp_backend.quality import CheckpointRunner

    runner = CheckpointRunner(artifact_store_path=str(tmp_path))

    bad_records = [
        {
            "employee_name": "",
            "trade_code": "ELEC",
            "week_ending": "not-a-date",
            "total_hours": -5,
            "hourly_rate": -10,
            "gross_pay": -100,
        },
    ]

    artifact = runner.run_checkpoint(
        "payroll_validation",
        bad_records,
        [],
        job_id="bad_batch_001",
    )

    assert not artifact.success
    assert runner.should_quarantine(artifact)

    # Get quarantined batches
    quarantined = runner.get_quarantined_batches()
    assert len(quarantined) == 1
    assert quarantined[0].artifact_id == "bad_batch_001"


# ---------------------------------------------------------------------------
# 13. Contract → Payroll → Analytics E2E flow
# ---------------------------------------------------------------------------


async def test_contract_payroll_analytics_e2e():
    """End-to-end: Create contract, import payroll, validate, check analytics."""
    from wcp_backend.contracts.schemas import ContractCreate
    from wcp_backend.payrolls.schemas import PayrollRecordCreate, PayrollBulkImportRequest
    from wcp_backend.quality import validate_payroll_records

    # Step 1: Create contract
    contract = ContractCreate(
        contract_number="TEST-2026-001",
        project_name="Test Project",
        contractor_name="Test Contractor",
        locality="Washington, DC",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
        total_value=Decimal("100000.00"),
    )
    assert contract.contract_number == "TEST-2026-001"
    assert contract.locality == "Washington, DC"

    # Step 2: Create payroll records for contract
    payroll_records = [
        PayrollRecordCreate(
            employee_name="John Doe",
            trade_code="ELEC",
            locality_code="DC",
            week_ending=date(2026, 4, 17),
            total_hours=Decimal("40.0"),
            hourly_rate=Decimal("51.69"),
            gross_pay=Decimal("2067.60"),
        ),
        PayrollRecordCreate(
            employee_name="Jane Smith",
            trade_code="CARP",
            locality_code="DC",
            week_ending=date(2026, 4, 17),
            total_hours=Decimal("38.0"),
            hourly_rate=Decimal("45.00"),
            gross_pay=Decimal("1710.00"),
        ),
    ]

    import_request = PayrollBulkImportRequest(
        contract_id=str(uuid.uuid4()),
        records=payroll_records,
        source="manual_test",
        source_reference="e2e_test.csv",
    )
    assert len(import_request.records) == 2

    # Step 3: Validate records
    records_for_validation = [r.model_dump() for r in payroll_records]
    validation_result = validate_payroll_records(records_for_validation)
    assert validation_result.success
    assert validation_result.failed_count == 0

    # Step 4: Simulate analytics calculation
    total_payroll = sum(r.gross_pay for r in payroll_records)
    assert total_payroll == Decimal("3777.60")

    unique_trades = set(r.trade_code for r in payroll_records)
    assert unique_trades == {"ELEC", "CARP"}


# ---------------------------------------------------------------------------
# 14. GE Runtime checkpoint with expectation suite
# ---------------------------------------------------------------------------


def test_ge_runtime_checkpoint_with_expectations():
    from wcp_backend.quality import GERuntime
    from wcp_backend.quality.payroll_expectations import payroll_expectation_suite

    runtime = GERuntime()

    good_records = [
        {
            "employee_name": "John Doe",
            "trade_code": "ELEC",
            "week_ending": "2026-04-17",
            "total_hours": 40,
            "hourly_rate": 51.69,
            "gross_pay": 2067.60,
        },
    ]

    suite = payroll_expectation_suite()
    result = runtime.run_checkpoint(
        "payroll_validation",
        good_records,
        suite.get("expectations", []),
    )

    assert "success" in result
    assert "failed_count" in result
    assert "statistics" in result


# ---------------------------------------------------------------------------
# 15. Full ingestion job with validation checkpoint
# ---------------------------------------------------------------------------


def test_full_ingestion_job_with_checkpoint(tmp_path: Any):
    """Complete ingestion flow: job creation → validation → checkpoint → quarantine decision."""
    from wcp_backend.ingestion.schemas import IngestionJobCreate
    from wcp_backend.quality import validate_and_checkpoint_payroll, CheckpointRunner

    # Create job
    job = IngestionJobCreate(
        type="payroll_import",
        source_type="sftp",
        source_reference="payroll_week20.csv",
        contract_id=str(uuid.uuid4()),
        total_records=3,
    )

    # Simulate payroll data with one bad record
    payroll_data = [
        {
            "employee_name": "John Doe",
            "trade_code": "ELEC",
            "week_ending": "2026-05-16",
            "total_hours": 40,
            "hourly_rate": 51.69,
            "gross_pay": 2067.60,
        },
        {
            "employee_name": "Jane Smith",
            "trade_code": "CARP",
            "week_ending": "2026-05-16",
            "total_hours": 38,
            "hourly_rate": 45.00,
            "gross_pay": 1710.00,
        },
        {
            "employee_name": "",  # Bad record
            "trade_code": "BAD",
            "week_ending": "invalid-date",
            "total_hours": -10,
            "hourly_rate": -5,
            "gross_pay": 0,
        },
    ]

    # Run validation checkpoint
    artifact = validate_and_checkpoint_payroll(
        payroll_data,
        job_id=f"job_{job.contract_id}",
    )

    # Verify checkpoint persisted
    assert artifact.artifact_path is not None

    # Should fail due to bad record
    assert not artifact.success

    # Verify artifact can be loaded
    runner = CheckpointRunner()
    loaded = runner.load_artifact(artifact.artifact_id)
    assert loaded is not None
    assert not loaded.success
