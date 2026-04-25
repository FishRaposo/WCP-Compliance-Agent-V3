from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class JobStatus(BaseModel):
    job_id: str
    status: str
    result: dict | None = None
    error: str | None = None
    created_at: str
    updated_at: str


@router.post("", response_model=JobStatus, status_code=202)
async def enqueue_job(payload: dict) -> JobStatus:
    # TODO: implement — dispatch Celery task, return job_id
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("/{job_id}", response_model=JobStatus)
async def get_job_status(job_id: str) -> JobStatus:
    # TODO: implement — query Celery result backend
    raise HTTPException(status_code=501, detail="Not implemented")
