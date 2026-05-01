from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field, model_validator


class PayrollRecordCreate(BaseModel):
    employee_name: str = Field(min_length=1)
    employee_id_hash: str | None = None
    trade_code: str = Field(min_length=1)
    locality_code: str = Field(min_length=1)
    week_ending: date
    hours_monday: Decimal | None = None
    hours_tuesday: Decimal | None = None
    hours_wednesday: Decimal | None = None
    hours_thursday: Decimal | None = None
    hours_friday: Decimal | None = None
    hours_saturday: Decimal | None = None
    hours_sunday: Decimal | None = None
    total_hours: Decimal = Field(ge=0)
    hourly_rate: Decimal = Field(ge=0)
    gross_pay: Decimal = Field(ge=0)
    fringe_rate: Decimal | None = Field(default=None, ge=0)
    fringe_total: Decimal | None = Field(default=None, ge=0)
    overtime_hours: Decimal = Field(default=Decimal("0"), ge=0)
    overtime_pay: Decimal = Field(default=Decimal("0"), ge=0)
    decision_id: str | None = None
    source_file: str | None = None

    @model_validator(mode="after")
    def validate_daily_hours(self) -> PayrollRecordCreate:
        for value in (
            self.hours_monday,
            self.hours_tuesday,
            self.hours_wednesday,
            self.hours_thursday,
            self.hours_friday,
            self.hours_saturday,
            self.hours_sunday,
        ):
            if value is not None and (value < 0 or value > 24):
                raise ValueError("daily hours must be between 0 and 24")
        return self


class PayrollBulkImportRequest(BaseModel):
    contract_id: str
    records: list[PayrollRecordCreate]
    source: str = "manual"
    source_reference: str | None = None


class PayrollRecordResponse(PayrollRecordCreate):
    id: str
    contract_id: str
    ingestion_job_id: str | None = None
    created_at: datetime
    decision_verdict: str | None = None
    decision_trust_score: float | None = None


class PayrollFilters(BaseModel):
    contract_id: str | None = None
    trade_code: str | None = None
    employee_name: str | None = None
    week_start: date | None = None
    week_end: date | None = None
    has_violation: bool | None = None


class PaginatedPayrolls(BaseModel):
    items: list[PayrollRecordResponse]
    total: int
    page: int
    per_page: int
    pages: int


class PayrollBulkImportResult(BaseModel):
    job_id: str
    created: int
    failed: int
    errors: list[dict[str, Any]] = Field(default_factory=list)
