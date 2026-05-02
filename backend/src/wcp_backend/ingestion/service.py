"""Ingestion — service layer for V4 bulk document processing.

Provides:
- Ingestion job CRUD with lifecycle tracking (started_at, completed_at)
- Progress updates with processed/failed counts
- Error aggregation per record
- Duplicate detection for contract numbers during bulk import
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import desc, func, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from wcp_backend.ingestion.schemas import (
    IngestionJobCreate,
    IngestionJobResponse,
    IngestionStatus,
)
from wcp_backend.services.tables import contracts_table, ingestion_jobs_table

logger = logging.getLogger(__name__)

__all__ = [
    "create_ingestion_job",
    "update_ingestion_job",
    "get_ingestion_status",
    "list_ingestion_jobs",
    "mark_job_started",
    "mark_job_completed",
]


def _job_response(row: Any) -> IngestionJobResponse:
    """Convert a database row to an IngestionJobResponse."""
    data = dict(row._mapping if hasattr(row, "_mapping") else row)
    data["job_id"] = data.pop("id")
    return IngestionJobResponse.model_validate(data)


async def create_ingestion_job(session: AsyncSession, data: IngestionJobCreate) -> str:
    """Create a new ingestion job record.

    Args:
        session: AsyncSession
        data: IngestionJobCreate with job metadata

    Returns:
        job_id (UUID string)
    """
    values = data.model_dump()
    result = await session.execute(
        insert(ingestion_jobs_table).values(**values).returning(ingestion_jobs_table.c.id)
    )
    job_id = result.scalar_one()
    await session.commit()
    logger.info("Created ingestion job %s (type=%s, total_records=%d)", job_id, data.type, data.total_records)
    return str(job_id)


async def update_ingestion_job(
    session: AsyncSession,
    job_id: str,
    status: IngestionStatus,
    processed_records: int,
    failed_records: int,
    error_details: list[dict[str, Any]],
) -> None:
    """Update ingestion job progress and status.

    Args:
        session: AsyncSession
        job_id: Job UUID
        status: New status (pending | processing | completed | failed | partial)
        processed_records: Number of successfully processed records
        failed_records: Number of failed records
        error_details: List of {row, error} dicts for failed records
    """
    update_values: dict[str, Any] = {
        "status": status,
        "processed_records": processed_records,
        "failed_records": failed_records,
        "error_details": error_details,
        "updated_at": datetime.now(timezone.utc),
    }

    # Set timestamps based on status transition
    if status == "processing":
        update_values["started_at"] = datetime.now(timezone.utc)
    elif status in ("completed", "failed", "partial"):
        update_values["completed_at"] = datetime.now(timezone.utc)

    await session.execute(
        update(ingestion_jobs_table)
        .where(ingestion_jobs_table.c.id == job_id)
        .values(**update_values)
    )
    await session.commit()


async def mark_job_started(session: AsyncSession, job_id: str) -> None:
    """Mark a job as started (processing).

    Args:
        session: AsyncSession
        job_id: Job UUID
    """
    await session.execute(
        update(ingestion_jobs_table)
        .where(ingestion_jobs_table.c.id == job_id)
        .values(status="processing", started_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc))
    )
    await session.commit()


async def mark_job_completed(
    session: AsyncSession,
    job_id: str,
    processed: int,
    failed: int,
    errors: list[dict[str, Any]],
) -> None:
    """Mark a job as completed or partial.

    Args:
        session: AsyncSession
        job_id: Job UUID
        processed: Successfully processed count
        failed: Failed count
        errors: Error details list
    """
    status = "completed" if failed == 0 else "partial"
    await session.execute(
        update(ingestion_jobs_table)
        .where(ingestion_jobs_table.c.id == job_id)
        .values(
            status=status,
            processed_records=processed,
            failed_records=failed,
            error_details=errors,
            completed_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
    )
    await session.commit()


async def get_ingestion_status(session: AsyncSession, job_id: str) -> IngestionJobResponse | None:
    """Get ingestion job status by ID.

    Args:
        session: AsyncSession
        job_id: Job UUID

    Returns:
        IngestionJobResponse or None if not found
    """
    result = await session.execute(
        select(ingestion_jobs_table).where(ingestion_jobs_table.c.id == job_id)
    )
    row = result.first()
    return _job_response(row) if row is not None else None


async def list_ingestion_jobs(
    session: AsyncSession,
    status: str | None = None,
    job_type: str | None = None,
    limit: int = 20,
) -> list[IngestionJobResponse]:
    """List recent ingestion jobs with optional filtering.

    Args:
        session: AsyncSession
        status: Filter by status (pending | processing | completed | failed | partial)
        job_type: Filter by type (contract_import | payroll_import | etc)
        limit: Maximum number of results

    Returns:
        List of IngestionJobResponse
    """
    query = select(ingestion_jobs_table)
    if status:
        query = query.where(ingestion_jobs_table.c.status == status)
    if job_type:
        query = query.where(ingestion_jobs_table.c.type == job_type)
    query = query.order_by(desc(ingestion_jobs_table.c.created_at)).limit(limit)
    result = await session.execute(query)
    return [_job_response(row) for row in result.fetchall()]


async def get_existing_contract_numbers(session: AsyncSession) -> set[str]:
    """Get set of existing contract numbers for duplicate detection.

    Args:
        session: AsyncSession

    Returns:
        Set of contract_number strings
    """
    result = await session.execute(select(contracts_table.c.contract_number))
    return {row.contract_number for row in result.fetchall() if row.contract_number}


async def check_contract_number_exists(session: AsyncSession, contract_number: str) -> bool:
    """Check if a contract number already exists.

    Args:
        session: AsyncSession
        contract_number: Contract number to check

    Returns:
        True if exists, False otherwise
    """
    result = await session.execute(
        select(func.count())
        .select_from(contracts_table)
        .where(contracts_table.c.contract_number == contract_number)
    )
    return (result.scalar() or 0) > 0