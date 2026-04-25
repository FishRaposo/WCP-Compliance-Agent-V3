from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field

from wcp_backend.models.enums import (
    CheckStatus,
    CheckType,
    OverallStatus,
    TrustBand,
    VerdictStatus,
)


class ContractorInfo(BaseModel):
    name: str
    address: str = ""
    ein: str = ""


class ProjectInfo(BaseModel):
    name: str
    location: str = ""
    contract_number: str = ""
    wage_determination_number: str = ""


class EmployeeRecord(BaseModel):
    name: str
    trade_classification: str
    hours_worked: float
    overtime_hours: float = 0.0
    hourly_wage: float
    fringe_benefits: float = 0.0
    gross_earnings: float
    deductions: float = 0.0
    net_wages: float


class ExtractedWCP(BaseModel):
    job_id: str
    contractor: ContractorInfo
    project: ProjectInfo
    employees: list[EmployeeRecord]
    certification_date: date | None = None
    payroll_number: int | None = None
    week_ending: date | None = None


class ComplianceCheck(BaseModel):
    check_id: str
    check_type: CheckType
    employee_name: str
    status: CheckStatus
    expected_value: float | None = None
    actual_value: float | None = None
    variance: float | None = None
    regulation_cite: str = ""
    message: str = ""


class DBWDRateRecord(BaseModel):
    trade: str
    locality: str
    rate: float
    fringe: float
    effective_date: date
    wage_determination_number: str = ""


class DeterministicReport(BaseModel):
    job_id: str
    checks: list[ComplianceCheck]
    overall_status: OverallStatus
    violation_count: int
    warning_count: int
    dbwd_rates_used: list[DBWDRateRecord] = Field(default_factory=list)


class Citation(BaseModel):
    regulation: str
    section: str = ""
    text: str = ""


class TokenUsage(BaseModel):
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class LLMVerdict(BaseModel):
    job_id: str
    verdict: VerdictStatus
    reasoning: str
    citations: list[Citation]
    confidence: float
    rag_context_used: bool = False
    model: str = ""
    prompt_version: str = ""
    langfuse_trace_id: str = ""
    token_usage: TokenUsage | None = None


class TrustScoredDecision(BaseModel):
    job_id: str
    verdict: VerdictStatus
    trust_score: float
    trust_band: TrustBand
    requires_human_review: bool
    violation_count: int
    warning_count: int
    llm_confidence: float
    reasoning_summary: str
    citations: list[Citation]
    cost_usd: float | None = None
    latency_ms: int | None = None
    phoenix_trace_id: str = ""
    created_at: datetime | None = None


class AuditEvent(BaseModel):
    event_id: UUID
    job_id: str
    event_type: str
    timestamp: datetime
    actor: str = "system"
    payload: dict = Field(default_factory=dict)
    regulation_references: list[str] = Field(default_factory=list)
    trace_id: str = ""
