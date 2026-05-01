"""Tests for V4 ingestion service and quality integration."""


from wcp_backend.ingestion.schemas import (
    IngestionJobCreate,
    BulkUploadResponse,
)
from wcp_backend.quality import validate_contracts, validate_payroll_records


class TestIngestionJobCreate:
    """Tests for IngestionJobCreate schema."""

    def test_accepts_required_fields(self) -> None:
        job = IngestionJobCreate(type="contract_import", source_type="csv")
        assert job.type == "contract_import"
        assert job.source_type == "csv"
        assert job.total_records == 0
        assert job.contract_id is None

    def test_accepts_all_fields(self) -> None:
        job = IngestionJobCreate(
            type="payroll_import",
            source_type="csv",
            source_reference="payroll_batch.csv",
            contract_id="contract-123",
            total_records=100,
        )
        assert job.type == "payroll_import"
        assert job.total_records == 100
        assert job.contract_id == "contract-123"

    def test_type_literal_restriction(self) -> None:
        # Valid types should not raise
        for t in ["contract_import", "payroll_import", "dbwd_refresh", "decision_export"]:
            job = IngestionJobCreate(type=t, source_type="csv")
            assert job.type == t

    def test_source_type_literal(self) -> None:
        for st in ["csv", "pdf", "api", "sftp", "database", "scheduled", "manual"]:
            job = IngestionJobCreate(type="contract_import", source_type=st)
            assert job.source_type == st


class TestBulkUploadResponse:
    """Tests for BulkUploadResponse schema."""

    def test_accepts_required_fields(self) -> None:
        resp = BulkUploadResponse(
            job_id="job-123",
            status="completed",
            total_records=50,
            message="Import completed",
        )
        assert resp.job_id == "job-123"
        assert resp.status == "completed"
        assert resp.total_records == 50

    def test_status_values(self) -> None:
        for status in ["pending", "processing", "completed", "failed", "partial"]:
            resp = BulkUploadResponse(
                job_id="job-123",
                status=status,
                total_records=10,
                message="test",
            )
            assert resp.status == status


class TestIngestionStatusValues:
    """Tests that ingestion types and statuses accept expected literals."""

    def test_ingestion_type_literals(self) -> None:
        valid_types = ["contract_import", "payroll_import", "dbwd_refresh", "decision_export"]
        for t in valid_types:
            job = IngestionJobCreate(type=t, source_type="csv")
            assert job.type == t

    def test_source_type_literals(self) -> None:
        valid_sources = ["csv", "pdf", "api", "sftp", "database", "scheduled", "manual"]
        for s in valid_sources:
            job = IngestionJobCreate(type="contract_import", source_type=s)
            assert job.source_type == s


class TestIngestionQualityIntegration:
    """Tests for integration between ingestion and quality validation."""

    def test_contract_validation_integrates_with_ingestion(self) -> None:
        """Contracts that fail validation should not be imported."""
        contracts = [
            {
                # Missing required fields — should fail validation
                "contract_number": "",
                "project_name": "",
            }
        ]
        result = validate_contracts(contracts)
        assert result.success is False

    def test_payroll_validation_integrates_with_ingestion(self) -> None:
        """Payroll records that fail validation should not be imported."""
        records = [
            {
                # Missing required fields — should fail validation
                "employee_name": "",
            }
        ]
        result = validate_payroll_records(records)
        assert result.success is False

    def test_valid_contracts_pass_validation(self) -> None:
        contracts = [
            {
                "contract_number": "GS-001",
                "project_name": "Test",
                "contractor_name": "Acme",
                "locality": "Boston, MA",
                "start_date": "2025-01-01",
            }
        ]
        result = validate_contracts(contracts)
        assert result.success is True