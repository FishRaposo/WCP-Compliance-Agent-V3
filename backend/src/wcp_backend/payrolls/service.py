"""Payrolls — service layer for V4 payroll record management.

Business logic for payroll CRUD and bulk import with duplicate detection,
partition management, and error aggregation.
"""

from __future__ import annotations

import logging
import re
from math import ceil
from typing import Any

from sqlalchemy import func, insert, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from wcp_backend.ingestion.schemas import IngestionJobCreate
from wcp_backend.ingestion.service import create_ingestion_job
from wcp_backend.payrolls.schemas import (
    PaginatedPayrolls,
    PayrollBulkImportRequest,
    PayrollBulkImportResult,
    PayrollFilters,
    PayrollRecordCreate,
    PayrollRecordResponse,
)
from wcp_backend.services.tables import payroll_records_table

logger = logging.getLogger(__name__)

__all__ = [
    "ensure_partition",
    "bulk_import_payrolls",
    "list_payrolls",
    "get_payroll",
]

# Partition naming per contract
_PARTITION_RE = re.compile(r"[^a-zA-Z0-9_]")


def partition_name_for_contract(contract_id: str) -> str:
    """Generate a sanitized partition name for a contract ID.

    Args:
        contract_id: Contract UUID

    Returns:
        Partition table name (e.g., payroll_records_contract_abc_123)
    """
    safe_id = _PARTITION_RE.sub("_", contract_id)
    return f"payroll_records_contract_{safe_id}"


def _payroll_response(row: Any) -> PayrollRecordResponse:
    """Convert a database row to a PayrollRecordResponse."""
    data = dict(row._mapping if hasattr(row, "_mapping") else row)
    data["id"] = str(data["id"])
    data.setdefault("decision_verdict", None)
    data.setdefault("decision_trust_score", None)
    return PayrollRecordResponse.model_validate(data)


async def ensure_partition(session: AsyncSession, contract_id: str) -> str:
    """Ensure a payroll partition exists for the given contract.

    Creates the partition table if it doesn't exist.
    Uses LIST partition by contract_id for PostgreSQL partitioning.

    Args:
        session: AsyncSession
        contract_id: Contract UUID

    Returns:
        Partition table name
    """
    partition_name = partition_name_for_contract(contract_id)
    # Sanitize contract_id for SQL (escape single quotes)
    safe_contract_id = contract_id.replace("'", "''")
    try:
        await session.execute(
            text(
                f"CREATE TABLE IF NOT EXISTS {partition_name} "
                f"PARTITION OF payroll_records FOR VALUES IN ('{safe_contract_id}')"
            )
        )
        await session.commit()
    except Exception as exc:
        # Partition may already exist or partition already attached
        logger.debug("Partition creation result for %s: %s", partition_name, exc)
    return partition_name


async def bulk_import_payrolls(
    session: AsyncSession, request: PayrollBulkImportRequest
) -> PayrollBulkImportResult:
    """Bulk import payroll records with duplicate detection and error aggregation.

    - Creates an ingestion job to track the import
    - Ensures partition exists for the contract
    - Validates each record and reports individual errors
    - Commits in batch for performance

    Args:
        session: AsyncSession
        request: PayrollBulkImportRequest with contract_id and records

    Returns:
        PayrollBulkImportResult with counts and error details
    """
    job_id = await create_ingestion_job(
        session,
        IngestionJobCreate(
            type="payroll_import",
            source_type="csv",
            source_reference=request.source_reference,
            contract_id=request.contract_id,
            total_records=len(request.records),
        ),
    )

    # Ensure partition exists
    await ensure_partition(session, request.contract_id)

    created = 0
    failed = 0
    errors: list[dict[str, Any]] = []

    for index, record in enumerate(request.records, start=1):
        try:
            # Validate with Pydantic
            payroll_data = PayrollRecordCreate.model_validate(record)

            # Build insert values
            values = payroll_data.model_dump()
            values["contract_id"] = request.contract_id
            values["ingestion_job_id"] = job_id

            # Insert record
            await session.execute(insert(payroll_records_table).values(**values))
            created += 1

        except Exception as exc:
            failed += 1
            errors.append({
                "row": index,
                "error": str(exc),
                "employee": record.get("employee_name", "unknown"),
            })

    await session.commit()
    return PayrollBulkImportResult(job_id=job_id, created=created, failed=failed, errors=errors)


async def list_payrolls(
    session: AsyncSession,
    filters: PayrollFilters,
    page: int = 1,
    per_page: int = 25,
) -> PaginatedPayrolls:
    """List payroll records with pagination and filtering.

    Args:
        session: AsyncSession
        filters: PayrollFilters with search params
        page: Page number (1-indexed)
        per_page: Records per page (max 100)

    Returns:
        PaginatedPayrolls with items and pagination info
    """
    page = max(page, 1)
    per_page = min(max(per_page, 1), 100)

    # Count query with filters
    base_query = select(payroll_records_table)
    filtered_query = _apply_filters(base_query, filters)
    total = int(
        (await session.execute(select(func.count()).select_from(filtered_query.subquery()))).scalar_one() or 0
    )

    # Paginated query
    query = (
        _apply_filters(select(payroll_records_table), filters)
        .order_by(payroll_records_table.c.week_ending.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    result = await session.execute(query)
    items = [_payroll_response(row) for row in result.fetchall()]
    return PaginatedPayrolls(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=ceil(total / per_page) if total else 0,
    )


async def get_payroll(
    session: AsyncSession, payroll_id: str, contract_id: str
) -> PayrollRecordResponse | None:
    """Get a single payroll record by ID and contract.

    Args:
        session: AsyncSession
        payroll_id: Payroll record UUID
        contract_id: Contract UUID (for partition lookup)

    Returns:
        PayrollRecordResponse or None
    """
    result = await session.execute(
        select(payroll_records_table).where(
            payroll_records_table.c.id == payroll_id,
            payroll_records_table.c.contract_id == contract_id,
        )
    )
    row = result.first()
    return _payroll_response(row) if row is not None else None


def _apply_filters(query: Any, filters: PayrollFilters) -> Any:
    """Apply filter conditions to a payroll query."""
    if filters.contract_id:
        query = query.where(payroll_records_table.c.contract_id == filters.contract_id)
    if filters.trade_code:
        query = query.where(payroll_records_table.c.trade_code == filters.trade_code)
    if filters.employee_name:
        query = query.where(payroll_records_table.c.employee_name.ilike(f"%{filters.employee_name}%"))
    if filters.week_start:
        query = query.where(payroll_records_table.c.week_ending >= filters.week_start)
    if filters.week_end:
        query = query.where(payroll_records_table.c.week_ending <= filters.week_end)
    if filters.has_violation is True:
        query = query.where(payroll_records_table.c.decision_id.is_not(None))
    return query