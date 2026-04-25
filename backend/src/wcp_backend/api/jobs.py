from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from wcp_backend.config import settings

router = APIRouter()

# Celery imports - allow graceful fallback if not configured
try:
    from celery import Celery
    from celery.result import AsyncResult
    
    celery_app = Celery(
        "wcp_backend",
        broker=settings.celery_broker_url,
        backend=settings.celery_broker_url,  # Use Redis as result backend
    )
    _CELERY_AVAILABLE = True
except Exception:
    _CELERY_AVAILABLE = False
    celery_app = None


class JobCreate(BaseModel):
    task_type: str  # e.g., "process_payroll", "batch_validate", "seed_dbwd"
    payload: dict[str, Any]


class JobStatus(BaseModel):
    job_id: str
    status: str  # pending, running, completed, failed
    result: dict[str, Any] | None = None
    error: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


@router.post("", response_model=JobStatus, status_code=202)
async def enqueue_job(job: JobCreate) -> JobStatus:
    """Enqueue a Celery task for async processing.
    
    Args:
        job: JobCreate with task_type and payload
        
    Returns:
        JobStatus with job_id and pending status
        
    Raises:
        HTTPException: 503 if Celery not available, 400 for invalid task type
    """
    if settings.phase < 2:
        raise HTTPException(status_code=503, detail="Jobs API requires Phase 2 (Celery)")
    
    if not _CELERY_AVAILABLE or celery_app is None:
        raise HTTPException(status_code=503, detail="Celery not configured")
    
    # Map task types to Celery task names
    task_mapping = {
        "process_payroll": "wcp_backend.services.job_queue.process_payroll_batch",
        "batch_validate": "wcp_backend.services.job_queue.run_batch_validation",
        "seed_dbwd": "wcp_backend.scripts.seed_dbwd.seed",
    }
    
    if job.task_type not in task_mapping:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown task_type: {job.task_type}. Valid types: {list(task_mapping.keys())}"
        )
    
    try:
        # Send task to Celery
        task_name = task_mapping[job.task_type]
        result = celery_app.send_task(task_name, args=[job.payload])
        
        return JobStatus(
            job_id=result.id,
            status="pending",
            result=None,
            error=None,
            created_at=datetime.utcnow().isoformat(),
            updated_at=None
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to enqueue job: {str(e)}")


@router.get("/{job_id}", response_model=JobStatus)
async def get_job_status(job_id: str) -> JobStatus:
    """Get status of a Celery job.
    
    Args:
        job_id: Celery task ID
        
    Returns:
        JobStatus with current state and result/error if completed
        
    Raises:
        HTTPException: 503 if Celery not available
    """
    if settings.phase < 2:
        raise HTTPException(status_code=503, detail="Jobs API requires Phase 2 (Celery)")
    
    if not _CELERY_AVAILABLE or celery_app is None:
        raise HTTPException(status_code=503, detail="Celery not configured")
    
    try:
        # Query task result
        result = AsyncResult(job_id, app=celery_app)
        
        # Map Celery states to our status
        state_mapping = {
            "PENDING": "pending",
            "STARTED": "running",
            "SUCCESS": "completed",
            "FAILURE": "failed",
            "RETRY": "running",
            "REVOKED": "failed",
        }
        
        status = state_mapping.get(result.state, "unknown")
        
        # Extract result or error
        job_result = None
        error = None
        
        if result.ready():
            if result.successful():
                job_result = result.result if isinstance(result.result, dict) else {"result": str(result.result)}
            else:
                error = str(result.result) if result.result else "Task failed"
        
        return JobStatus(
            job_id=job_id,
            status=status,
            result=job_result,
            error=error,
            created_at=None,  # Celery doesn't track creation time
            updated_at=datetime.utcnow().isoformat()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get job status: {str(e)}")
