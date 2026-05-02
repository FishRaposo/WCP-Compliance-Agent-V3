"""Wage check — verifies employee hourly rate meets DBWD minimum."""

from __future__ import annotations

from wcp_backend.models.schemas import ComplianceCheck, DBWDRateRecord, EmployeeRecord
from wcp_backend.models.enums import CheckStatus, CheckType
from wcp_backend.pipeline.checks import _slugify


def check_wage(employee: EmployeeRecord, dbwd_rate: DBWDRateRecord) -> ComplianceCheck:
    """
    Pass: employee.hourly_wage >= dbwd_rate.rate
    Fail: employee.hourly_wage < dbwd_rate.rate
    Regulation: 40 U.S.C. § 3142
    """
    expected = dbwd_rate.rate
    actual = employee.hourly_wage
    variance = actual - expected
    
    passed = actual >= expected
    
    if passed:
        status = CheckStatus.PASS
        message = f"Wage meets DBWD minimum: ${actual:.2f}/hr >= ${expected:.2f}/hr"
    else:
        status = CheckStatus.FAIL
        message = f"Wage violation: ${actual:.2f}/hr is ${abs(variance):.2f} below minimum ${expected:.2f}/hr"
    
    return ComplianceCheck(
        check_id=f"wage_{_slugify(employee.name)}",
        check_type=CheckType.WAGE,
        employee_name=employee.name,
        status=status,
        expected_value=expected,
        actual_value=actual,
        variance=variance,
        regulation_cite="40 U.S.C. § 3142",
        message=message
    )


