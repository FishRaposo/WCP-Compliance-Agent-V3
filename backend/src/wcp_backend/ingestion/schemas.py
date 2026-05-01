from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

IngestionType = Literal["contract_import", "payroll_import", "dbwd_refresh", "decision_export"]
IngestionStatus = Literal["pending", "processing", "completed", "failed", "partial"]
SourceType = Literal["csv", "pdf", "api", "sftp", "database", "scheduled", "manual"]


class IngestionJobCreate(BaseModel):
    type: IngestionType
    source_type: SourceType
    source_reference: str | None = None
    contract_id: str | None = None
    total_records: int = Field(default=0, ge=0)


class IngestionJobResponse(BaseModel):
    job_id: str
    type: str
    status: str
    source_type: str
    source_reference: str | None = None
    contract_id: str | None = None
    total_records: int
    processed_records: int
    failed_records: int
    error_details: list[dict[str, Any]] = Field(default_factory=list)
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class BulkUploadResponse(BaseModel):
    job_id: str
    status: str
    total_records: int
    message: str
