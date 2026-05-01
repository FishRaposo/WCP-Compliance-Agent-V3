from __future__ import annotations

from typing import Any

from sqlalchemy import desc, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from wcp_backend.ingestion.schemas import IngestionJobCreate, IngestionJobResponse
from wcp_backend.services.tables import ingestion_jobs_table


def _job_response(row: Any) -> IngestionJobResponse:
    data = dict(row._mapping if hasattr(row, "_mapping") else row)
    data["job_id"] = data.pop("id")
    return IngestionJobResponse.model_validate(data)


async def create_ingestion_job(session: AsyncSession, data: IngestionJobCreate) -> str:
    values = data.model_dump()
    result = await session.execute(insert(ingestion_jobs_table).values(**values).returning(ingestion_jobs_table.c.id))
    job_id = result.scalar_one()
    await session.commit()
    return str(job_id)


async def update_ingestion_job(
    session: AsyncSession,
    job_id: str,
    status: str,
    processed_records: int,
    failed_records: int,
    error_details: list[dict[str, Any]],
) -> None:
    await session.execute(
        update(ingestion_jobs_table)
        .where(ingestion_jobs_table.c.id == job_id)
        .values(
            status=status,
            processed_records=processed_records,
            failed_records=failed_records,
            error_details=error_details,
        )
    )
    await session.commit()


async def get_ingestion_status(session: AsyncSession, job_id: str) -> IngestionJobResponse | None:
    result = await session.execute(select(ingestion_jobs_table).where(ingestion_jobs_table.c.id == job_id))
    row = result.first()
    return _job_response(row) if row is not None else None


async def list_ingestion_jobs(
    session: AsyncSession,
    status: str | None = None,
    job_type: str | None = None,
    limit: int = 20,
) -> list[IngestionJobResponse]:
    query = select(ingestion_jobs_table)
    if status:
        query = query.where(ingestion_jobs_table.c.status == status)
    if job_type:
        query = query.where(ingestion_jobs_table.c.type == job_type)
    query = query.order_by(desc(ingestion_jobs_table.c.created_at)).limit(limit)
    result = await session.execute(query)
    return [_job_response(row) for row in result.fetchall()]
