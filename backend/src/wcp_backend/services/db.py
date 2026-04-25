"""asyncpg connection pool and SQLAlchemy async session factory."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from wcp_backend.config import settings

engine = create_async_engine(settings.database_url, echo=False, pool_size=10, max_overflow=20)
async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def init_db() -> None:
    """Initialize DB connection pool; called on app startup."""
    async with engine.begin():
        pass  # TODO: run Alembic migrations programmatically if needed


async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session
