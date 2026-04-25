from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from wcp_backend.config import settings

router = APIRouter()


class ServiceHealth(BaseModel):
    status: str
    message: str


class HealthResponse(BaseModel):
    status: str
    version: str
    phase: int
    services: dict[str, ServiceHealth] | None = None


@router.get("/health", response_model=HealthResponse)
async def health_check() -> dict[str, Any]:
    """Health check endpoint that verifies all infrastructure services."""
    # For Phase 1, return simple health check
    # For Phase 2+, check all services
    if settings.phase < 2:
        return {
            "status": "ok",
            "version": "3.0.2",
            "phase": settings.phase,
        }
    
    # Phase 2+: Check all infrastructure services
    from wcp_backend.services.health_check import get_health_status
    return await get_health_status()
