from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from wcp_backend.payrolls import service
from wcp_backend.payrolls.schemas import (
    PaginatedPayrolls,
    PayrollBulkImportRequest,
    PayrollBulkImportResult,
    PayrollFilters,
    PayrollRecordResponse,
)
from wcp_backend.services.db import get_session

router = APIRouter(prefix="/payrolls", tags=["v4-payrolls"])


@router.get("", response_model=PaginatedPayrolls)
async def list_payrolls(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    contract_id: str | None = None,
    trade_code: str | None = None,
    employee_name: str | None = None,
    week_start: date | None = None,
    week_end: date | None = None,
    has_violation: bool | None = None,
    session: AsyncSession = Depends(get_session),
) -> PaginatedPayrolls:
    filters = PayrollFilters(
        contract_id=contract_id,
        trade_code=trade_code,
        employee_name=employee_name,
        week_start=week_start,
        week_end=week_end,
        has_violation=has_violation,
    )
    return await service.list_payrolls(session, filters, page, per_page)


@router.get("/{contract_id}/{payroll_id}", response_model=PayrollRecordResponse)
async def get_payroll(contract_id: str, payroll_id: str, session: AsyncSession = Depends(get_session)) -> PayrollRecordResponse:
    record = await service.get_payroll(session, payroll_id, contract_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Payroll record not found")
    return record


@router.post("/bulk", response_model=PayrollBulkImportResult, status_code=status.HTTP_202_ACCEPTED)
async def bulk_import_payrolls(request: PayrollBulkImportRequest, session: AsyncSession = Depends(get_session)) -> PayrollBulkImportResult:
    return await service.bulk_import_payrolls(session, request)
