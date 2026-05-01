from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

ContractStatus = Literal["active", "completed", "terminated", "suspended"]
ContractSource = Literal["manual", "sftp", "api", "database", "csv"]


class ContractCreate(BaseModel):
    contract_number: str = Field(min_length=1)
    project_name: str = Field(min_length=1)
    contractor_name: str = Field(min_length=1)
    contractor_ein: str | None = None
    agency: str | None = None
    locality: str = Field(min_length=1)
    start_date: date
    end_date: date | None = None
    total_value: Decimal | None = None
    source: ContractSource = "manual"
    source_reference: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ContractUpdate(BaseModel):
    project_name: str | None = None
    contractor_name: str | None = None
    contractor_ein: str | None = None
    agency: str | None = None
    locality: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    total_value: Decimal | None = None
    status: ContractStatus | None = None
    source_reference: str | None = None
    metadata: dict[str, Any] | None = None


class ContractFilters(BaseModel):
    status: ContractStatus | None = None
    contractor: str | None = None
    locality: str | None = None
    sort: str = "created_at"
    order: Literal["asc", "desc"] = "desc"


class ContractResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    contract_number: str
    project_name: str
    contractor_name: str
    contractor_ein: str | None = None
    agency: str | None = None
    locality: str
    start_date: date
    end_date: date | None = None
    total_value: Decimal | None = None
    status: str
    source: str
    source_reference: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    decision_count: int = 0
    payroll_record_count: int = 0
    latest_decision_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class PaginatedContracts(BaseModel):
    items: list[ContractResponse]
    total: int
    page: int
    per_page: int
    pages: int


class BulkImportResult(BaseModel):
    job_id: str
    created: int
    skipped: int
    failed: int
    errors: list[dict[str, Any]] = Field(default_factory=list)
