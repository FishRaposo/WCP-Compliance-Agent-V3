"""Fringe benefits check - verifies fringe meets DBWD fringe rate."""

from __future__ import annotations

from wcp_backend.models.enums import CheckStatus, CheckType
from wcp_backend.models.schemas import ComplianceCheck, DBWDRateRecord, EmployeeRecord
from wcp_backend.pipeline.checks import _slugify


def check_fringe(employee: EmployeeRecord, dbwd_rate: DBWDRateRecord) -> ComplianceCheck:
    """
    Pass: employee.fringe_benefits >= dbwd_rate.fringe * hours_worked
    Regulation: 40 U.S.C. Section 3141(2)(B)
    """
    expected_fringe_total = dbwd_rate.fringe * employee.hours_worked
    actual_fringe = employee.fringe_benefits or 0.0
    variance = actual_fringe - expected_fringe_total

    passed = actual_fringe >= expected_fringe_total

    if passed:
        status = CheckStatus.PASS
        message = (
            f"Fringe benefits meet DBWD: "
            f"${actual_fringe:.2f} >= ${expected_fringe_total:.2f} "
            f"(${dbwd_rate.fringe:.2f}/hr x {employee.hours_worked} hrs)"
        )
    else:
        status = CheckStatus.FAIL
        message = (
            f"Fringe violation: ${actual_fringe:.2f} is "
            f"${abs(variance):.2f} below required ${expected_fringe_total:.2f} "
            f"(${dbwd_rate.fringe:.2f}/hr x {employee.hours_worked} hrs)"
        )

    return ComplianceCheck(
        check_id=f"fringe_{_slugify(employee.name)}",
        check_type=CheckType.FRINGE,
        employee_name=employee.name,
        status=status,
        expected_value=expected_fringe_total,
        actual_value=actual_fringe,
        variance=variance,
        regulation_cite="40 U.S.C. § 3141(2)(B)",
        message=message,
    )


