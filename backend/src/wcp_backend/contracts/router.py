from __future__ import annotations

import csv
import io
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from wcp_backend.contracts import service
from wcp_backend.contracts.schemas import (
    BulkImportResult,
    ContractCreate,
    ContractFilters,
    ContractResponse,
    ContractUpdate,
    PaginatedContracts,
)
from wcp_backend.services.db import get_session

router = APIRouter(prefix="/v4/contracts", tags=["v4-contracts"])


@router.get("", response_model=PaginatedContracts)
async def list_contracts(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    status_filter: Literal["active", "completed", "terminated", "suspended"] | None = Query(
        None, alias="status"
    ),
    contractor: str | None = None,
    locality: str | None = None,
    sort: str = "created_at",
    order: Literal["asc", "desc"] = "desc",
    session: AsyncSession = Depends(get_session),
) -> PaginatedContracts:
    filters = ContractFilters(
        status=status_filter, contractor=contractor, locality=locality, sort=sort, order=order
    )
    return await service.list_contracts(session, filters, page, per_page)


@router.post("", response_model=ContractResponse, status_code=status.HTTP_201_CREATED)
async def create_contract(data: ContractCreate, session: AsyncSession = Depends(get_session)) -> ContractResponse:
    return await service.create_contract(session, data)


@router.get("/{contract_id}", response_model=ContractResponse)
async def get_contract(contract_id: str, session: AsyncSession = Depends(get_session)) -> ContractResponse:
    contract = await service.get_contract(session, contract_id)
    if contract is None:
        raise HTTPException(status_code=404, detail="Contract not found")
    return contract


@router.put("/{contract_id}", response_model=ContractResponse)
async def update_contract(contract_id: str, data: ContractUpdate, session: AsyncSession = Depends(get_session)) -> ContractResponse:
    contract = await service.update_contract(session, contract_id, data)
    if contract is None:
        raise HTTPException(status_code=404, detail="Contract not found")
    return contract


@router.delete("/{contract_id}")
async def delete_contract(contract_id: str, session: AsyncSession = Depends(get_session)) -> dict[str, str]:
    deleted = await service.delete_contract(session, contract_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Contract not found")
    return {"status": "terminated"}


@router.post("/bulk", response_model=BulkImportResult, status_code=status.HTTP_202_ACCEPTED)
async def bulk_import_contracts(file: UploadFile = File(...), session: AsyncSession = Depends(get_session)) -> BulkImportResult:
    content = (await file.read()).decode("utf-8-sig")
    records = list(csv.DictReader(io.StringIO(content)))
    return await service.bulk_import_contracts(session, records, file.filename)
