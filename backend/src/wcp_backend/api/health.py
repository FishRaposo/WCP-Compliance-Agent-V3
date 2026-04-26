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
async def health_check() -> HealthResponse:
    """Health check endpoint that verifies all infrastructure services."""
    if settings.phase < 2:
        return HealthResponse(
            status="ok",
            version="3.0.0",
            phase=settings.phase,
        )

    from wcp_backend.services.health_check import get_health_status

    status = await get_health_status()
    return HealthResponse(
        status=status["status"],
        version=status["version"],
        phase=status["phase"],
        services={
            k: ServiceHealth(status=v["status"], message=v["message"])
            for k, v in status.get("services", {}).items()
        },
    )
