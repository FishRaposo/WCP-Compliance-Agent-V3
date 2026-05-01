from __future__ import annotations

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

_ALLOWED_SORTS = {
    "created_at": contracts_table.c.created_at,
    "contract_number": contracts_table.c.contract_number,
    "project_name": contracts_table.c.project_name,
    "contractor_name": contracts_table.c.contractor_name,
    "start_date": contracts_table.c.start_date,
}


def _contract_response(row: Any) -> ContractResponse:
    data = dict(row._mapping if hasattr(row, "_mapping") else row)
    data.setdefault("decision_count", 0)
    data.setdefault("payroll_record_count", 0)
    data.setdefault("latest_decision_at", None)
    return ContractResponse.model_validate(data)


def _apply_filters(query: Any, filters: ContractFilters) -> Any:
    if filters.status:
        query = query.where(contracts_table.c.status == filters.status)
    if filters.contractor:
        query = query.where(contracts_table.c.contractor_name.ilike(f"%{filters.contractor}%"))
    if filters.locality:
        query = query.where(contracts_table.c.locality.ilike(f"%{filters.locality}%"))
    return query


async def create_contract(session: AsyncSession, data: ContractCreate) -> ContractResponse:
    values = data.model_dump()
    result = await session.execute(insert(contracts_table).values(**values).returning(contracts_table))
    row = result.first()
    await session.commit()
    if row is None:
        raise RuntimeError("contract insert did not return a row")
    return _contract_response(row)


async def get_contract(session: AsyncSession, contract_id: str) -> ContractResponse | None:
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
    page = max(page, 1)
    per_page = min(max(per_page, 1), 100)
    count_query = _apply_filters(select(func.count()).select_from(contracts_table), filters)
    total = int((await session.execute(count_query)).scalar_one() or 0)
    sort_col = _ALLOWED_SORTS.get(filters.sort, contracts_table.c.created_at)
    order_by = asc(sort_col) if filters.order == "asc" else desc(sort_col)
    query = _apply_filters(select(contracts_table), filters).order_by(order_by).offset((page - 1) * per_page).limit(per_page)
    result = await session.execute(query)
    items = [_contract_response(row) for row in result.fetchall()]
    return PaginatedContracts(items=items, total=total, page=page, per_page=per_page, pages=ceil(total / per_page) if total else 0)


async def update_contract(session: AsyncSession, contract_id: str, data: ContractUpdate) -> ContractResponse | None:
    values = data.model_dump(exclude_unset=True)
    if not values:
        return await get_contract(session, contract_id)
    result = await session.execute(update(contracts_table).where(contracts_table.c.id == contract_id).values(**values).returning(contracts_table))
    row = result.first()
    await session.commit()
    return _contract_response(row) if row is not None else None


async def delete_contract(session: AsyncSession, contract_id: str) -> bool:
    result = await session.execute(update(contracts_table).where(contracts_table.c.id == contract_id).values(status="terminated").returning(contracts_table.c.id))
    await session.commit()
    return result.first() is not None


async def bulk_import_contracts(session: AsyncSession, records: list[dict[str, Any]], source_reference: str | None = None) -> BulkImportResult:
    job_id = await create_ingestion_job(session, IngestionJobCreate(type="contract_import", source_type="csv", source_reference=source_reference, total_records=len(records)))
    created = 0
    errors: list[dict[str, Any]] = []
    for index, record in enumerate(records, start=1):
        try:
            await create_contract(session, ContractCreate.model_validate({**record, "source": "csv", "source_reference": source_reference}))
            created += 1
        except Exception as exc:
            errors.append({"row": index, "error": str(exc)})
    return BulkImportResult(job_id=job_id, created=created, skipped=0, failed=len(errors), errors=errors)
