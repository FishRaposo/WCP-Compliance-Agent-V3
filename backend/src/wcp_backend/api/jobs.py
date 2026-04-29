import logging
from datetime import datetime
from typing import Any
from uuid import uuid4

from celery import Celery  # type: ignore[import-untyped]
from celery.result import AsyncResult  # type: ignore[import-untyped]
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.sql import func

from wcp_backend.config import settings
from wcp_backend.models.enums import JobStatus
from wcp_backend.services.db import async_session
from wcp_backend.services.tables import jobs_table

logger = logging.getLogger(__name__)
router = APIRouter()

# Celery setup - allow graceful fallback if not configured
try:
    celery_app = Celery(
        "wcp_backend",
        broker=settings.celery_broker_url,
        backend=settings.celery_broker_url,
    )
    _CELERY_AVAILABLE = True
except Exception:
    _CELERY_AVAILABLE = False
    celery_app = None


class JobCreate(BaseModel):
    task_type: str
    payload: dict[str, Any]


class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    result: dict[str, Any] | None = None
    error: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


@router.post("", response_model=JobStatusResponse, status_code=202)
async def enqueue_job(job: JobCreate) -> JobStatusResponse:
    """Enqueue a Celery task for async processing and track in PostgreSQL."""
    if settings.phase < 2:
        raise HTTPException(status_code=503, detail="Jobs API requires Phase 2 (Celery)")

    if not _CELERY_AVAILABLE or celery_app is None:
        raise HTTPException(status_code=503, detail="Celery not configured")

    task_mapping = {
        "process_payroll": "wcp_backend.services.job_queue.process_payroll_batch",
        "batch_validate": "wcp_backend.services.job_queue.run_eval",
    }

    if job.task_type not in task_mapping:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown task_type: {job.task_type}. Valid types: {list(task_mapping.keys())}",
        )

    try:
        job_id = str(uuid4())
        async with async_session() as session:
            await session.execute(
                jobs_table.insert().values(
                    job_id=job_id,
                    status=JobStatus.PENDING,
                    payload=job.payload,
                )
            )
            await session.commit()

        task_name = task_mapping[job.task_type]
        celery_result = celery_app.send_task(
            task_name,
            args=[job_id, job.payload.get("items", [job.payload])],
        )

        async with async_session() as session:
            await session.execute(
                jobs_table.update()
                .where(jobs_table.c.job_id == job_id)
                .values(
                    celery_task_id=celery_result.id,
                    status=JobStatus.PROCESSING,
                    updated_at=func.now(),
                )
            )
            await session.commit()

        return JobStatusResponse(
            job_id=job_id,
            status=JobStatus.PROCESSING,
            result=None,
            error=None,
            created_at=datetime.utcnow().isoformat(),
            updated_at=None,
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("enqueue_job failed")
        raise HTTPException(status_code=500, detail="Failed to enqueue job")


@router.get("/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str) -> JobStatusResponse:
    """Get status of a job from PostgreSQL (with Celery sync if running)."""
    if settings.phase < 2:
        raise HTTPException(status_code=503, detail="Jobs API requires Phase 2 (Celery)")

    try:
        async with async_session() as session:
            query = select(jobs_table).where(jobs_table.c.job_id == job_id)
            result = await session.execute(query)
            row = result.fetchone()

            if not row:
                raise HTTPException(status_code=404, detail="Job not found")

            status = row.status
            job_result = row.result
            error = row.error
            updated_at = row.updated_at.isoformat() if row.updated_at else None

            if status in (JobStatus.PENDING, JobStatus.PROCESSING) and row.celery_task_id and _CELERY_AVAILABLE:
                try:
                    celery_result = AsyncResult(row.celery_task_id, app=celery_app)
                    state_mapping = {
                        "PENDING": JobStatus.PENDING,
                        "STARTED": JobStatus.PROCESSING,
                        "SUCCESS": JobStatus.COMPLETE,
                        "FAILURE": JobStatus.FAILED,
                        "RETRY": JobStatus.PROCESSING,
                        "REVOKED": JobStatus.FAILED,
                    }
                    celery_status = state_mapping.get(celery_result.state, JobStatus.PENDING)

                    if celery_status != status:
                        if celery_result.ready():
                            if celery_result.successful():
                                job_result = (
                                    celery_result.result
                                    if isinstance(celery_result.result, dict)
                                    else {"result": str(celery_result.result)}
                                )
                            else:
                                error = str(celery_result.result) if celery_result.result else "Task failed"
                                job_result = None

                        await session.execute(
                            jobs_table.update()
                            .where(jobs_table.c.job_id == job_id)
                            .values(
                                status=celery_status,
                                result=job_result,
                                error=error,
                                updated_at=func.now(),
                            )
                        )
                        await session.commit()
                        status = celery_status
                        updated_at = datetime.utcnow().isoformat()
                except Exception:
                    logger.debug("Celery state unavailable, using DB status")

            return JobStatusResponse(
                job_id=job_id,
                status=status,
                result=job_result,
                error=error,
                created_at=row.created_at.isoformat() if row.created_at else None,
                updated_at=updated_at,
            )
    except HTTPException:
        raise
    except Exception:
        logger.exception("get_job_status failed")
        raise HTTPException(status_code=500, detail="Failed to get job status")
