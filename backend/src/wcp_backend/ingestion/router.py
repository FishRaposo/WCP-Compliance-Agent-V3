"""Ingestion — FastAPI router for V4 bulk document processing.

Provides:
- GET /v4/ingestion/status/:job_id — Get ingestion job status
- GET /v4/ingestion/jobs — List recent ingestion jobs
- POST /v4/ingestion/bulk-upload — Enterprise bulk upload endpoint (CSV or PDF)

POST /v4/ingestion/bulk-upload:
- Accepts multipart/form-data with file + type + optional contract_id
- Supported types: contract_import, payroll_import
- Creates ingestion job and processes records asynchronously
- Returns job_id for polling status endpoint
"""

from __future__ import annotations

import csv
import io
import logging
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from wcp_backend.ingestion import schemas as ingestion_schemas
from wcp_backend.ingestion.service import (
    create_ingestion_job,
    get_ingestion_status,
    list_ingestion_jobs,
    update_ingestion_job,
)
from wcp_backend.services.db import get_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v4/ingestion", tags=["v4-ingestion"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class BulkUploadRequest:
    """Multipart form for bulk upload."""

    file: UploadFile
    type: str  # contract_import | payroll_import
    contract_id: str | None = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/status/{job_id}", response_model=ingestion_schemas.IngestionJobResponse)
async def get_ingestion_status_endpoint(
    job_id: str,
    session: AsyncSession = Depends(get_session),
) -> ingestion_schemas.IngestionJobResponse:
    """Get ingestion job status by job ID.

    Returns current status, progress counts, and error details for a
    specific ingestion job.
    """
    job = await get_ingestion_status(session, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Ingestion job not found")
    return job


@router.get("/jobs", response_model=list[ingestion_schemas.IngestionJobResponse])
async def list_ingestion_jobs_endpoint(
    status_filter: str | None = Query(None, alias="status"),
    type_filter: str | None = Query(None, alias="type"),
    limit: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
) -> list[ingestion_schemas.IngestionJobResponse]:
    """List recent ingestion jobs with optional filtering."""
    return await list_ingestion_jobs(
        session, status=status_filter, job_type=type_filter, limit=limit
    )


@router.post(
    "/bulk-upload",
    response_model=ingestion_schemas.BulkUploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def bulk_upload(
    file: UploadFile = File(...),
    type: str = Query(..., pattern="^(contract_import|payroll_import)$"),
    contract_id: str | None = Query(None),
    session: AsyncSession = Depends(get_session),
) -> ingestion_schemas.BulkUploadResponse:
    """Enterprise bulk upload endpoint.

    Accepts CSV file for contract_import or payroll_import.
    - contract_import: parses CSV into contract records, calls contracts service
    - payroll_import: requires contract_id, parses CSV into payroll records

    Processing is synchronous for MVP (async via Celery in V4.1).
    Returns job_id for polling status at GET /v4/ingestion/status/{job_id}.

    For large files (>1000 records), prefer async processing via Celery.
    """
    # Validate file type
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    filename_lower = file.filename.lower()
    if not filename_lower.endswith(".csv") and not filename_lower.endswith(".pdf"):
        raise HTTPException(
            status_code=415,
            detail="Unsupported file type. Only CSV and PDF are supported.",
        )

    # Read file content
    try:
        content = (await file.read()).decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8 encoded")

    # Parse CSV
    try:
        records = list(csv.DictReader(io.StringIO(content)))
    except csv.Error as exc:
        raise HTTPException(status_code=400, detail=f"CSV parsing error: {exc}")

    if not records:
        raise HTTPException(status_code=400, detail="CSV file contains no data rows")

    total_records = len(records)

    # Create ingestion job
    job_create = ingestion_schemas.IngestionJobCreate(
        type=type,
        source_type="csv",
        source_reference=file.filename,
        contract_id=contract_id,
        total_records=total_records,
    )
    job_id = await create_ingestion_job(session, job_create)

    # Mark job as processing
    await update_ingestion_job(
        session,
        job_id,
        status="processing",
        processed_records=0,
        failed_records=0,
        error_details=[],
    )

    # Process based on type
    processed = 0
    failed = 0
    errors: list[dict[str, Any]] = []

    try:
        if type == "contract_import":
            processed, failed, errors = await _process_contract_import(
                session, records, job_id
            )
        elif type == "payroll_import":
            if not contract_id:
                raise HTTPException(
                    status_code=400,
                    detail="contract_id is required for payroll_import",
                )
            processed, failed, errors = await _process_payroll_import(
                session, records, job_id, contract_id
            )
    except Exception as exc:
        logger.exception("bulk_upload processing failed for job %s", job_id)
        final_status = "failed"
        errors.append({"row": 0, "error": str(exc)})
    else:
        final_status = "completed" if failed == 0 else "partial"

    # Update final job status
    await update_ingestion_job(
        session,
        job_id,
        status=final_status,
        processed_records=processed,
        failed_records=failed,
        error_details=errors,
    )

    message = (
        f"Bulk import completed: {processed} processed, {failed} failed"
        if final_status == "completed"
        else f"Bulk import {final_status}: {processed} processed, {failed} failed"
    )

    return ingestion_schemas.BulkUploadResponse(
        job_id=job_id,
        status=final_status,
        total_records=total_records,
        message=message,
    )


async def _process_contract_import(
    session: AsyncSession,
    records: list[dict[str, Any]],
    job_id: str,
) -> tuple[int, int, list[dict[str, Any]]]:
    """Process contract import records.

    Returns (processed, failed, errors).
    """
    from wcp_backend.contracts.schemas import ContractCreate
    from wcp_backend.contracts.service import create_contract

    processed = 0
    failed = 0
    errors: list[dict[str, Any]] = []

    for index, record in enumerate(records, start=1):
        try:
            # Validate required fields
            if not record.get("contract_number") or not record.get("project_name"):
                raise ValueError("contract_number and project_name are required")

            contract_data = ContractCreate.model_validate({
                **record,
                "source": "csv",
                "source_reference": job_id,
            })
            await create_contract(session, contract_data)
            processed += 1
        except Exception as exc:
            failed += 1
            errors.append({"row": index, "error": str(exc)})

    return processed, failed, errors


async def _process_payroll_import(
    session: AsyncSession,
    records: list[dict[str, Any]],
    job_id: str,
    contract_id: str,
) -> tuple[int, int, list[dict[str, Any]]]:
    """Process payroll import records.

    Returns (processed, failed, errors).
    """
    from wcp_backend.payrolls.schemas import PayrollRecordCreate
    from wcp_backend.payrolls.service import ensure_partition

    from sqlalchemy import insert
    from wcp_backend.services.tables import payroll_records_table

    processed = 0
    failed = 0
    errors: list[dict[str, Any]] = []

    # Ensure partition exists
    await ensure_partition(session, contract_id)

    for index, record in enumerate(records, start=1):
        try:
            payroll_data = PayrollRecordCreate.model_validate(record)
            values = payroll_data.model_dump()
            values["contract_id"] = contract_id
            values["ingestion_job_id"] = job_id
            await session.execute(insert(payroll_records_table).values(**values))
            processed += 1
        except Exception as exc:
            failed += 1
            errors.append({"row": index, "error": str(exc)})

    await session.commit()
    return processed, failed, errors