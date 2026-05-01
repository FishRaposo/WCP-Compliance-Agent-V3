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
from wcp_backend.analytics.router import router as v4_analytics_router
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
# V4 routers: each already has its own module-level prefix baked in
# (e.g. /v4/analytics, /contracts, /payrolls, /v4/ingestion)
router.include_router(v4_analytics_router, tags=["v4-analytics"])
router.include_router(contracts_router, tags=["v4-contracts"])
router.include_router(payrolls_router, tags=["v4-payrolls"])
router.include_router(ingestion_router, tags=["v4-ingestion"])