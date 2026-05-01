from fastapi import APIRouter

from wcp_backend.api import (
    analytics,
    auth,
    dbwd,
    decisions,
    extract,
    health,
    jobs,
    search,
    validate,
)
from wcp_backend.contracts.router import router as contracts_router
from wcp_backend.ingestion.router import router as ingestion_router
from wcp_backend.payrolls.router import router as payrolls_router

router = APIRouter()

router.include_router(health.router, tags=["health"])
router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(extract.router, prefix="/extract", tags=["extraction"])
router.include_router(validate.router, prefix="/validate", tags=["validation"])
router.include_router(dbwd.router, prefix="/dbwd", tags=["dbwd"])
router.include_router(decisions.router, prefix="/decisions", tags=["decisions"])
router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
router.include_router(search.router, prefix="/search", tags=["search"])
router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
router.include_router(contracts_router, prefix="/v4")
router.include_router(payrolls_router, prefix="/v4")
router.include_router(ingestion_router, prefix="/v4")
