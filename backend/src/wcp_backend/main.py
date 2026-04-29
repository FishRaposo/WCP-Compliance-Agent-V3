from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from wcp_backend.api.router import router
from wcp_backend.config import settings
from wcp_backend.observability.phoenix_setup import init_phoenix
from wcp_backend.services.db import init_db

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    await init_db()
    try:
        init_phoenix()
    except Exception:
        logger.warning("Phoenix initialization failed", exc_info=True)
        # Phoenix is optional — non-fatal if unavailable
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="WCP Compliance Backend",
        version="3.0.0",
        description="Deterministic payroll compliance validation for Davis-Bacon Act",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(router)
    return app


app = create_app()
