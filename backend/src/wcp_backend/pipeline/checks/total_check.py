"""Total check — verifies gross earnings and net wages arithmetic."""

from __future__ import annotations

from wcp_backend.models.schemas import ComplianceCheck, EmployeeRecord
from wcp_backend.models.enums import CheckStatus, CheckType
from wcp_backend.pipeline.checks import _slugify

TOLERANCE = 0.01  # $0.01 rounding tolerance


def check_totals(employee: EmployeeRecord) -> ComplianceCheck:
    """
    Pass: gross ≈ (hours × wage) + (overtime × wage × 0.5) within tolerance
    AND net_wages ≈ gross_earnings - deductions within tolerance
    Regulation: 29 C.F.R. § 5.5(a)(3)(i) (arithmetic accuracy)
    """
    # Check 1: Gross earnings calculation
    ot_hours = employee.overtime_hours or 0.0
    
    # Expected gross: straight-time pay plus the overtime half-time premium.
    expected_gross = (employee.hours_worked * employee.hourly_wage) + (
        ot_hours * employee.hourly_wage * 0.5
    )
    
    actual_gross = employee.gross_earnings
    gross_variance = actual_gross - expected_gross
    gross_within_tolerance = abs(gross_variance) <= TOLERANCE
    
    # Check 2: Net wages calculation
    expected_net = actual_gross - (employee.deductions or 0.0)
    actual_net = employee.net_wages
    net_variance = actual_net - expected_net
    net_within_tolerance = abs(net_variance) <= TOLERANCE
    
    # Determine overall status
    if gross_within_tolerance and net_within_tolerance:
        status = CheckStatus.PASS
        message = f"Arithmetic correct: Gross ${actual_gross:.2f} (expected ${expected_gross:.2f}), Net ${actual_net:.2f}"
    else:
        status = CheckStatus.FAIL
        issues = []
        if not gross_within_tolerance:
            issues.append(f"Gross variance ${gross_variance:.2f}")
        if not net_within_tolerance:
            issues.append(f"Net variance ${net_variance:.2f}")
        message = f"Arithmetic error: {'; '.join(issues)}"
    
    return ComplianceCheck(
        check_id=f"total_{_slugify(employee.name)}",
        check_type=CheckType.TOTAL,
        employee_name=employee.name,
        status=status,
        expected_value=expected_gross,
        actual_value=actual_gross,
        variance=gross_variance,
        regulation_cite="29 C.F.R. § 5.5(a)(3)(i)",
        message=message
    )


