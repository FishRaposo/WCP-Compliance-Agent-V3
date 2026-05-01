from __future__ import annotations

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
    PayrollRecordResponse,
)
from wcp_backend.services.tables import payroll_records_table


def partition_name_for_contract(contract_id: str) -> str:
    safe_id = re.sub(r"[^a-zA-Z0-9_]", "_", contract_id)
    return f"payroll_records_contract_{safe_id}"


def _payroll_response(row: Any) -> PayrollRecordResponse:
    data = dict(row._mapping if hasattr(row, "_mapping") else row)
    data["id"] = str(data["id"])
    data.setdefault("decision_verdict", None)
    data.setdefault("decision_trust_score", None)
    return PayrollRecordResponse.model_validate(data)


async def ensure_partition(session: AsyncSession, contract_id: str) -> str:
    partition_name = partition_name_for_contract(contract_id)
    await session.execute(
        text(
            f"CREATE TABLE IF NOT EXISTS {partition_name} "
            "PARTITION OF payroll_records FOR VALUES IN (:contract_id)"
        ),
        {"contract_id": contract_id},
    )
    await session.commit()
    return partition_name


def _apply_filters(query: Any, filters: PayrollFilters) -> Any:
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


async def bulk_import_payrolls(session: AsyncSession, request: PayrollBulkImportRequest) -> PayrollBulkImportResult:
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
    await ensure_partition(session, request.contract_id)
    created = 0
    errors: list[dict[str, Any]] = []
    for index, record in enumerate(request.records, start=1):
        try:
            values = record.model_dump()
            values["contract_id"] = request.contract_id
            values["ingestion_job_id"] = job_id
            await session.execute(insert(payroll_records_table).values(**values))
            created += 1
        except Exception as exc:
            errors.append({"row": index, "error": str(exc)})
    await session.commit()
    return PayrollBulkImportResult(job_id=job_id, created=created, failed=len(errors), errors=errors)


async def list_payrolls(session: AsyncSession, filters: PayrollFilters, page: int = 1, per_page: int = 25) -> PaginatedPayrolls:
    page = max(page, 1)
    per_page = min(max(per_page, 1), 100)
    total = int((await session.execute(_apply_filters(select(func.count()).select_from(payroll_records_table), filters))).scalar_one() or 0)
    query = _apply_filters(select(payroll_records_table), filters).order_by(payroll_records_table.c.week_ending.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await session.execute(query)
    return PaginatedPayrolls(items=[_payroll_response(row) for row in result.fetchall()], total=total, page=page, per_page=per_page, pages=ceil(total / per_page) if total else 0)


async def get_payroll(session: AsyncSession, payroll_id: str, contract_id: str) -> PayrollRecordResponse | None:
    result = await session.execute(select(payroll_records_table).where(payroll_records_table.c.id == payroll_id, payroll_records_table.c.contract_id == contract_id))
    row = result.first()
    return _payroll_response(row) if row is not None else None
