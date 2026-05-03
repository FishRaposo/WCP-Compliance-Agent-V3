"""Prefect ETL — Bulk ingestion orchestration (V4).

Purpose: Orchestrate large-scale contract/payroll ingestion from CSV/PDF/API sources.

Flow steps:
1. Ingest contract metadata
2. Validate contracts with GE suite
3. Bulk-import payroll records per contract
4. Validate payroll records with GE suite
5. Link to existing decisions via contract_id

Responsibilities:
- Coordinate multi-step ingestion
- Per-contract partitioning setup
- GE validation at each stage
- Error quarantine for failed records
"""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Any

from wcp_backend.contracts.schemas import ContractCreate
from wcp_backend.contracts.service import create_contract
from wcp_backend.ingestion.schemas import IngestionJobCreate
from wcp_backend.ingestion.service import create_ingestion_job, mark_job_completed, mark_job_started
from wcp_backend.payrolls.schemas import PayrollBulkImportRequest, PayrollRecordCreate
from wcp_backend.payrolls.service import bulk_import_payrolls
from wcp_backend.pipelines.utils import prefect_flow, prefect_task
from wcp_backend.quality.contract_expectations import validate_contracts
from wcp_backend.quality.payroll_expectations import validate_payroll_records
from wcp_backend.services.db import async_session

__all__ = ["bulk_ingest_flow"]


@prefect_task()
async def load_csv_records(source_reference: str) -> list[dict[str, Any]]:
    path = Path(source_reference)
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


@prefect_task()
async def import_contract_records(records: list[dict[str, Any]], source_reference: str) -> dict[str, Any]:
    validation = validate_contracts(records)
    failed_rows = {error["row"] for error in validation.errors}
    async with async_session() as session:
        job_id = await create_ingestion_job(
            session,
            IngestionJobCreate(
                type="contract_import",
                source_type="csv",
                source_reference=source_reference,
                total_records=len(records),
            ),
        )
        await mark_job_started(session, job_id)
        processed = 0
        errors = list(validation.errors)
        for index, record in enumerate(records, start=1):
            if index in failed_rows:
                continue
            try:
                await create_contract(
                    session,
                    ContractCreate.model_validate(
                        {**record, "source": "csv", "source_reference": source_reference}
                    ),
                )
                processed += 1
            except Exception as exc:
                errors.append({"row": index, "errors": [str(exc)]})
        failed = len(errors)
        await mark_job_completed(session, job_id, processed, failed, errors)
        return {
            "job_id": job_id,
            "processed_records": processed,
            "failed_records": failed,
            "errors": errors,
        }


@prefect_task()
async def import_payroll_records(
    records: list[dict[str, Any]], source_reference: str, contract_id: str
) -> dict[str, Any]:
    validation = validate_payroll_records(records)
    if not validation.success:
        return {
            "job_id": None,
            "processed_records": 0,
            "failed_records": validation.failed_count,
            "errors": validation.errors,
        }
    async with async_session() as session:
        # Convert dict records to PayrollRecordCreate objects
        payroll_records = [PayrollRecordCreate.model_validate(r) for r in records]
        result = await bulk_import_payrolls(
            session,
            PayrollBulkImportRequest(
                contract_id=contract_id,
                records=payroll_records,
                source="csv",
                source_reference=source_reference,
            ),
        )
        return result.model_dump()


@prefect_flow(name="bulk-ingest", description="Validate and import V4 contract/payroll files")
async def bulk_ingest_flow(
    source_type: str,
    source_reference: str,
    ingest_type: str = "contract_import",
    contract_id: str | None = None,
) -> dict[str, Any]:
    """Execute bulk ingestion flow.

    Args:
        source_type: csv | pdf | api
        source_reference: Path or URL to source data.

    Returns:
        Dict with ingestion results: status, job_id, total_records,
        processed_records, failed_records, errors.
    """
    if source_type != "csv":
        raise ValueError("V4 bulk_ingest_flow currently supports csv sources")
    records = await load_csv_records(source_reference)
    if ingest_type == "contract_import":
        result = await import_contract_records(records, source_reference)
    elif ingest_type == "payroll_import":
        if not contract_id:
            raise ValueError("contract_id is required for payroll_import")
        result = await import_payroll_records(records, source_reference, contract_id)
    else:
        raise ValueError(f"Unsupported ingest_type: {ingest_type}")
    return {
        "status": "success" if result["failed_records"] == 0 else "partial",
        "total_records": len(records),
        **result,
    }
