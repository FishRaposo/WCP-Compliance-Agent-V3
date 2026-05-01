"""Contracts — service layer for V4 contract management.

Business logic for contract CRUD and bulk import with duplicate detection.
"""

from __future__ import annotations

import logging
from math import ceil
from typing import Any

from sqlalchemy import asc, desc, func, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from wcp_backend.contracts.schemas import (
    BulkImportResult,
    ContractCreate,
    ContractFilters,
    ContractResponse,
    ContractUpdate,
    PaginatedContracts,
)
from wcp_backend.ingestion.schemas import IngestionJobCreate
from wcp_backend.ingestion.service import create_ingestion_job
from wcp_backend.services.tables import contracts_table, decisions_table, payroll_records_table

logger = logging.getLogger(__name__)

__all__ = [
    "create_contract",
    "get_contract",
    "list_contracts",
    "update_contract",
    "delete_contract",
    "bulk_import_contracts",
]

_ALLOWED_SORTS = {
    "created_at": contracts_table.c.created_at,
    "contract_number": contracts_table.c.contract_number,
    "project_name": contracts_table.c.project_name,
    "contractor_name": contracts_table.c.contractor_name,
    "start_date": contracts_table.c.start_date,
}


def _contract_response(row: Any) -> ContractResponse:
    """Convert a database row to a ContractResponse."""
    data = dict(row._mapping if hasattr(row, "_mapping") else row)
    data.setdefault("decision_count", 0)
    data.setdefault("payroll_record_count", 0)
    data.setdefault("latest_decision_at", None)
    return ContractResponse.model_validate(data)


def _apply_filters(query: Any, filters: ContractFilters) -> Any:
    """Apply filter conditions to a contracts query."""
    if filters.status:
        query = query.where(contracts_table.c.status == filters.status)
    if filters.contractor:
        query = query.where(contracts_table.c.contractor_name.ilike(f"%{filters.contractor}%"))
    if filters.locality:
        query = query.where(contracts_table.c.locality.ilike(f"%{filters.locality}%"))
    return query


async def create_contract(session: AsyncSession, data: ContractCreate) -> ContractResponse:
    """Create a new contract.

    Args:
        session: AsyncSession
        data: ContractCreate request data

    Returns:
        ContractResponse for the newly created contract

    Raises:
        ValueError: If contract_number already exists
    """
    # Check for duplicate contract_number
    existing = await session.execute(
        select(func.count())
        .select_from(contracts_table)
        .where(contracts_table.c.contract_number == data.contract_number)
    )
    if (existing.scalar() or 0) > 0:
        raise ValueError(f"Contract number already exists: {data.contract_number}")

    values = data.model_dump()
    result = await session.execute(
        insert(contracts_table).values(**values).returning(contracts_table)
    )
    row = result.first()
    await session.commit()
    if row is None:
        raise RuntimeError("contract insert did not return a row")
    return _contract_response(row)


async def get_contract(session: AsyncSession, contract_id: str) -> ContractResponse | None:
    """Get a contract by ID with computed stats.

    Args:
        session: AsyncSession
        contract_id: Contract UUID

    Returns:
        ContractResponse or None
    """
    decision_count = (
        select(func.count())
        .select_from(decisions_table)
        .where(decisions_table.c.contract_id == contracts_table.c.id)
        .scalar_subquery()
    )
    payroll_count = (
        select(func.count())
        .select_from(payroll_records_table)
        .where(payroll_records_table.c.contract_id == contracts_table.c.id)
        .scalar_subquery()
    )
    latest_decision = (
        select(func.max(decisions_table.c.created_at))
        .where(decisions_table.c.contract_id == contracts_table.c.id)
        .scalar_subquery()
    )
    result = await session.execute(
        select(
            contracts_table,
            decision_count.label("decision_count"),
            payroll_count.label("payroll_record_count"),
            latest_decision.label("latest_decision_at"),
        ).where(contracts_table.c.id == contract_id)
    )
    row = result.first()
    return _contract_response(row) if row is not None else None


async def list_contracts(
    session: AsyncSession,
    filters: ContractFilters,
    page: int = 1,
    per_page: int = 25,
) -> PaginatedContracts:
    """List contracts with pagination and filtering.

    Args:
        session: AsyncSession
        filters: ContractFilters with search/filter params
        page: Page number (1-indexed)
        per_page: Records per page (max 100)

    Returns:
        PaginatedContracts with items, total, page info
    """
    page = max(page, 1)
    per_page = min(max(per_page, 1), 100)

    # Count query
    count_query = _apply_filters(select(func.count()).select_from(contracts_table), filters)
    total = int((await session.execute(count_query)).scalar_one() or 0)

    # Sort and paginate
    sort_col = _ALLOWED_SORTS.get(filters.sort, contracts_table.c.created_at)
    order_by = asc(sort_col) if filters.order == "asc" else desc(sort_col)
    query = (
        _apply_filters(select(contracts_table), filters)
        .order_by(order_by)
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    result = await session.execute(query)
    items = [_contract_response(row) for row in result.fetchall()]
    return PaginatedContracts(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=ceil(total / per_page) if total else 0,
    )


async def update_contract(
    session: AsyncSession, contract_id: str, data: ContractUpdate
) -> ContractResponse | None:
    """Update contract fields.

    Args:
        session: AsyncSession
        contract_id: Contract UUID
        data: ContractUpdate with fields to update

    Returns:
        Updated ContractResponse or None if not found
    """
    values = data.model_dump(exclude_unset=True)
    if not values:
        return await get_contract(session, contract_id)
    result = await session.execute(
        update(contracts_table)
        .where(contracts_table.c.id == contract_id)
        .values(**values)
        .returning(contracts_table)
    )
    row = result.first()
    await session.commit()
    return _contract_response(row) if row is not None else None


async def delete_contract(session: AsyncSession, contract_id: str) -> bool:
    """Soft-delete a contract (sets status to terminated).

    Args:
        session: AsyncSession
        contract_id: Contract UUID

    Returns:
        True if contract was found and terminated, False if not found
    """
    result = await session.execute(
        update(contracts_table)
        .where(contracts_table.c.id == contract_id)
        .values(status="terminated", updated_at=func.now())
        .returning(contracts_table.c.id)
    )
    await session.commit()
    return result.first() is not None


async def bulk_import_contracts(
    session: AsyncSession,
    records: list[dict[str, Any]],
    source_reference: str | None = None,
) -> BulkImportResult:
    """Bulk import contracts with duplicate detection and error handling.

    - Skips records with duplicate contract_number (doesn't fail the batch)
    - Reports individual row errors without stopping the batch
    - Creates an ingestion job to track the import

    Args:
        session: AsyncSession
        records: List of contract dicts from parsed CSV
        source_reference: Original filename for audit trail

    Returns:
        BulkImportResult with counts and error details
    """
    job_id = await create_ingestion_job(
        session,
        IngestionJobCreate(
            type="contract_import",
            source_type="csv",
            source_reference=source_reference,
            total_records=len(records),
        ),
    )

    created = 0
    skipped = 0
    failed = 0
    errors: list[dict[str, Any]] = []

    # Pre-fetch existing contract numbers to detect duplicates
    existing_result = await session.execute(select(contracts_table.c.contract_number))
    existing_numbers = {row.contract_number for row in existing_result.fetchall() if row.contract_number}

    for index, record in enumerate(records, start=1):
        try:
            contract_number = record.get("contract_number", "").strip()

            # Duplicate check
            if contract_number in existing_numbers:
                skipped += 1
                errors.append({
                    "row": index,
                    "error": f"Duplicate contract_number: {contract_number}",
                    "contract_number": contract_number,
                })
                continue

            # Validate required fields
            if not contract_number or not record.get("project_name"):
                raise ValueError("contract_number and project_name are required")

            # Create contract
            contract_data = ContractCreate.model_validate({
                **record,
                "source": "csv",
                "source_reference": source_reference,
            })
            await create_contract(session, contract_data)
            existing_numbers.add(contract_number)  # Prevent duplicates within this batch
            created += 1

        except Exception as exc:
            failed += 1
            errors.append({"row": index, "error": str(exc)})

    return BulkImportResult(
        job_id=job_id,
        created=created,
        skipped=skipped,
        failed=failed,
        errors=errors,
    )