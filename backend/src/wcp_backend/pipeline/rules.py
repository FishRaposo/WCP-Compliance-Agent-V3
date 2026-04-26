"""Rule engine — runs all compliance checks against an ExtractedWCP."""

from __future__ import annotations

import asyncio

from wcp_backend.config import settings
from wcp_backend.models.enums import CheckStatus, CheckType, OverallStatus, TrustBand, VerdictStatus
from wcp_backend.models.schemas import (
    ComplianceCheck,
    DBWDRateRecord,
    DeterministicReport,
    EmployeeRecord,
    ExtractedWCP,
    LLMVerdict,
)
from wcp_backend.observability.metrics import trust_score_histogram
from wcp_backend.observability.tracing import trace_span
from wcp_backend.pipeline.checks.fringe_check import check_fringe
from wcp_backend.pipeline.checks.overtime_check import check_overtime
from wcp_backend.pipeline.checks.signature_check import check_signature
from wcp_backend.pipeline.checks.total_check import check_totals
from wcp_backend.pipeline.checks.wage_check import check_wage
from wcp_backend.pipeline.dbwd_lookup import get_dbwd_rate


@trace_span("run_rule_engine", attributes={"component": "rule_engine"})
async def run_rule_engine(extracted: ExtractedWCP) -> DeterministicReport:
    """Run all compliance checks. Returns a DeterministicReport."""
    checks: list[ComplianceCheck] = []
    dbwd_rates: list[DBWDRateRecord] = []

    unique_trades = {e.trade_classification for e in extracted.employees}
    trade_to_rate: dict[str, DBWDRateRecord] = {}
    effective_date = extracted.week_ending.isoformat() if extracted.week_ending else "2026-01-01"
    locality = extracted.project.location or "Washington, DC"

    # Fetch DBWD rates in parallel
    rate_tasks = [
        _fetch_dbwd_rate(trade, locality, effective_date)
        for trade in unique_trades
    ]
    rate_results = await asyncio.gather(*rate_tasks, return_exceptions=True)

    for trade, result in zip(unique_trades, rate_results):
        if isinstance(result, DBWDRateRecord):
            dbwd_rates.append(result)
            trade_to_rate[trade] = result
        else:
            checks.append(ComplianceCheck(
                check_id=f"classification_{trade.lower().replace(' ', '_')}",
                check_type=CheckType.CLASSIFICATION,
                employee_name="_multiple_",
                status=CheckStatus.FAIL,
                expected_value=None,
                actual_value=None,
                variance=None,
                regulation_cite="29 C.F.R. § 5.5(a)(3)(i)",
                message=(
                    f"{result}; "
                    "prevailing wage compliance was not verified"
                )
            ))

    # Run checks per employee
    for employee in extracted.employees:
        rate = trade_to_rate.get(employee.trade_classification)

        if rate:
            checks.append(check_wage(employee, rate))
            checks.append(check_fringe(employee, rate))

        checks.append(check_overtime(employee))
        checks.append(check_totals(employee))
        checks.append(_check_data_integrity(employee))
        checks.append(_check_minimum_wage_sanity(employee))

    # Signature/certification check (once per WCP, not per employee)
    checks.append(check_signature(extracted))

    # Aggregate results
    violation_count = sum(1 for c in checks if c.status == CheckStatus.FAIL)
    warning_count = sum(1 for c in checks if c.status == CheckStatus.WARNING)

    if violation_count > 0:
        overall_status = OverallStatus.FAIL
    elif warning_count > 0:
        overall_status = OverallStatus.WARNINGS
    else:
        overall_status = OverallStatus.PASS

    return DeterministicReport(
        job_id=extracted.job_id,
        checks=checks,
        overall_status=overall_status,
        violation_count=violation_count,
        warning_count=warning_count,
        dbwd_rates_used=dbwd_rates
    )


async def _fetch_dbwd_rate(trade: str, locality: str, effective_date: str) -> DBWDRateRecord:
    """Helper to fetch a single DBWD rate. Raises on failure."""
    return await get_dbwd_rate(trade, locality, effective_date)


def _check_data_integrity(employee: EmployeeRecord) -> ComplianceCheck:
    """Check for obvious data inconsistencies."""
    issues = []

    if employee.hourly_wage <= 0:
        issues.append("hourly wage must be positive")
    if employee.hours_worked < 0:
        issues.append("hours worked cannot be negative")
    if employee.hours_worked > 168:
        issues.append("hours worked exceeds 168 (impossible)")
    if (employee.deductions or 0) > employee.gross_earnings:
        issues.append("deductions exceed gross earnings")
    if employee.net_wages < 0:
        issues.append("net wages cannot be negative")

    if issues:
        return ComplianceCheck(
            check_id=f"integrity_{_slugify(employee.name)}",
            check_type=CheckType.DATA_INTEGRITY,
            employee_name=employee.name,
            status=CheckStatus.FAIL,
            expected_value=None,
            actual_value=None,
            variance=None,
            regulation_cite="29 C.F.R. § 5.5(a)(3)(ii)",
            message=f"Data integrity issues: {'; '.join(issues)}"
        )

    return ComplianceCheck(
        check_id=f"integrity_{_slugify(employee.name)}",
        check_type=CheckType.DATA_INTEGRITY,
        employee_name=employee.name,
        status=CheckStatus.PASS,
        expected_value=None,
        actual_value=None,
        variance=None,
        regulation_cite="29 C.F.R. § 5.5(a)(3)(ii)",
        message="Data integrity check passed"
    )


def _check_minimum_wage_sanity(employee: EmployeeRecord) -> ComplianceCheck:
    """Check if wage is at least federal minimum wage ($7.25/hr)."""
    FEDERAL_MINIMUM_WAGE = 7.25

    if employee.hourly_wage < FEDERAL_MINIMUM_WAGE:
        return ComplianceCheck(
            check_id=f"minwage_{_slugify(employee.name)}",
            check_type=CheckType.MINIMUM_WAGE,
            employee_name=employee.name,
            status=CheckStatus.FAIL,
            expected_value=FEDERAL_MINIMUM_WAGE,
            actual_value=employee.hourly_wage,
            variance=FEDERAL_MINIMUM_WAGE - employee.hourly_wage,
            regulation_cite="29 U.S.C. § 206(a)(1)",
            message=f"Hourly wage ${employee.hourly_wage:.2f} is below federal minimum wage ${FEDERAL_MINIMUM_WAGE:.2f}"
        )

    return ComplianceCheck(
        check_id=f"minwage_{_slugify(employee.name)}",
        check_type=CheckType.MINIMUM_WAGE,
        employee_name=employee.name,
        status=CheckStatus.PASS,
        expected_value=FEDERAL_MINIMUM_WAGE,
        actual_value=employee.hourly_wage,
        variance=employee.hourly_wage - FEDERAL_MINIMUM_WAGE,
        regulation_cite="29 U.S.C. § 206(a)(1)",
        message=f"Hourly wage meets federal minimum (${employee.hourly_wage:.2f} >= ${FEDERAL_MINIMUM_WAGE:.2f})"
    )


def compute_trust_components(
    deterministic: DeterministicReport,
    llm_verdict: LLMVerdict
) -> dict[str, float]:
    """
    Compute trust score components using calibrated weights from V2.

    Calibrated weights (do not adjust without regression testing):
    - deterministic: 0.35
    - classification: 0.25
    - llm_self: 0.20
    - agreement: 0.20
    """
    violation_ratio = deterministic.violation_count / max(len(deterministic.checks), 1)
    deterministic_score = 1.0 - violation_ratio
    classification_score = 0.95
    llm_score = llm_verdict.confidence
    agreement_score = _compute_agreement(deterministic, llm_verdict)

    return {
        "deterministic": 0.35 * deterministic_score,
        "classification": 0.25 * classification_score,
        "llm_self": 0.20 * llm_score,
        "agreement": 0.20 * agreement_score
    }


def compute_trust_score(components: dict[str, float]) -> float:
    """Compute final trust score from components."""
    score = sum(components.values())
    trust_score_histogram.record(score)
    return score


def determine_trust_band(score: float) -> TrustBand:
    """
    Determine trust band from score using configured thresholds.

    Bands:
    - >= high_band: AUTO_APPROVE
    - medium_band-high_band: FLAG_FOR_REVIEW
    - < medium_band: REQUIRE_HUMAN_REVIEW
    """
    if score >= settings.trust_score_high_band:
        return TrustBand.AUTO_APPROVE
    elif score >= settings.trust_score_medium_band:
        return TrustBand.FLAG_FOR_REVIEW
    else:
        return TrustBand.REQUIRE_HUMAN_REVIEW


def _compute_agreement(deterministic: DeterministicReport, llm_verdict: LLMVerdict) -> float:
    """
    Compute agreement score between deterministic findings and LLM verdict.

    Scoring:
    - 1.0: All checks pass and LLM says APPROVED
    - 0.0: Critical check failed but LLM says APPROVED (major disagreement)
    - 0.5: Adjacent verdict (e.g., REJECTED vs REVISE)
    """
    has_violations = deterministic.violation_count > 0
    llm_approved = llm_verdict.verdict == VerdictStatus.APPROVED

    if has_violations and llm_approved:
        return 0.0
    elif not has_violations and llm_approved:
        return 1.0
    else:
        return 0.5


def _slugify(name: str) -> str:
    """Convert name to slug for check_id."""
    return name.lower().replace(" ", "_").replace("-", "_")
