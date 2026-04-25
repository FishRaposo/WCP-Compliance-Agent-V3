from fastapi import APIRouter

from wcp_backend.api import (
    analytics,
    dbwd,
    decisions,
    extract,
    health,
    jobs,
    search,
    validate,
)

router = APIRouter()

router.include_router(health.router, tags=["health"])
router.include_router(extract.router, prefix="/extract", tags=["extraction"])
router.include_router(validate.router, prefix="/validate", tags=["validation"])
router.include_router(dbwd.router, prefix="/dbwd", tags=["dbwd"])
router.include_router(decisions.router, prefix="/decisions", tags=["decisions"])
router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
router.include_router(search.router, prefix="/search", tags=["search"])
router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
