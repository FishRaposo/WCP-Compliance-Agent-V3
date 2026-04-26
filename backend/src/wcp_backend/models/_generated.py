# Auto-generated from shared/schemas/*.json - do not edit manually
from typing import Any
from pydantic import BaseModel

class AuditEvent(BaseModel):
    event_id: str
    job_id: str
    event_type: str
    timestamp: str
    actor: str | None = None
    payload: dict[str, Any] | None = None
    regulation_references: list[Any] | None = None
    trace_id: str | None = None

class DeterministicReport(BaseModel):
    job_id: str
    checks: list[Any]
    overall_status: str
    violation_count: int | None = None
    warning_count: int | None = None
    dbwd_rates_used: list[Any] | None = None

class ExtractedWCP(BaseModel):
    job_id: str
    contractor: dict[str, Any]
    project: dict[str, Any]
    employees: list[Any]
    certification_date: str | None = None
    payroll_number: int | None = None
    week_ending: str | None = None

class LLMVerdict(BaseModel):
    job_id: str
    verdict: str
    reasoning: str
    citations: list[Any]
    confidence: float
    rag_context_used: bool | None = None
    model: str | None = None
    prompt_version: str | None = None
    langfuse_trace_id: str | None = None
    token_usage: dict[str, Any] | None = None

class TrustScoredDecision(BaseModel):
    job_id: str
    verdict: str
    trust_score: float
    trust_band: str
    requires_human_review: bool
    violation_count: int | None = None
    warning_count: int | None = None
    llm_confidence: float | None = None
    reasoning_summary: str | None = None
    citations: list[Any] | None = None
    cost_usd: float | None = None
    latency_ms: int | None = None
    phoenix_trace_id: str | None = None
    created_at: str | None = None
