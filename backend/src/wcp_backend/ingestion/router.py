from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from wcp_backend.ingestion import service
from wcp_backend.ingestion.schemas import IngestionJobResponse
from wcp_backend.services.db import get_session

router = APIRouter(prefix="/ingestion", tags=["v4-ingestion"])


@router.get("/status/{job_id}", response_model=IngestionJobResponse)
async def get_ingestion_status(job_id: str, session: AsyncSession = Depends(get_session)) -> IngestionJobResponse:
    job = await service.get_ingestion_status(session, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Ingestion job not found")
    return job


@router.get("/jobs", response_model=list[IngestionJobResponse])
async def list_ingestion_jobs(
    status: str | None = None,
    type_filter: str | None = Query(None, alias="type"),
    limit: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
) -> list[IngestionJobResponse]:
    return await service.list_ingestion_jobs(session, status=status, job_type=type_filter, limit=limit)
