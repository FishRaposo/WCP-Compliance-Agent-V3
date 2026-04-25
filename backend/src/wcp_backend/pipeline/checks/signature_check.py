"""Signature / certification check — verifies WH-347 is properly certified."""

from __future__ import annotations

from datetime import date

from wcp_backend.models.schemas import ComplianceCheck, ExtractedWCP
from wcp_backend.models.enums import CheckStatus, CheckType


def check_signature(extracted: ExtractedWCP) -> ComplianceCheck:
    """
    Pass: certification_date is present and not future-dated
    Regulation: 29 C.F.R. § 5.5(a)(3)(ii)(B) (certification requirement)
    """
    has_cert_date = extracted.certification_date is not None
    is_future_dated = False
    
    if has_cert_date:
        # Check if certification date is in the future
        if hasattr(extracted.certification_date, 'date'):
            cert_date = extracted.certification_date.date()
        else:
            cert_date = extracted.certification_date
        
        is_future_dated = cert_date > date.today()
    
    # Also check payroll number if present
    has_payroll_number = extracted.payroll_number is not None and extracted.payroll_number > 0
    
    if not has_cert_date:
        status = CheckStatus.FAIL
        message = "Missing certification date"
    elif is_future_dated:
        status = CheckStatus.FAIL
        message = f"Certification date is in the future: {extracted.certification_date}"
    else:
        status = CheckStatus.PASS
        date_str = str(extracted.certification_date)
        payroll_info = f" (Payroll #{extracted.payroll_number})" if has_payroll_number else ""
        message = f"Certification date present: {date_str}{payroll_info}"
    
    return ComplianceCheck(
        check_id="signature_certification",
        check_type=CheckType.SIGNATURE,
        employee_name="_all_",  # Applies to entire WCP, not per employee
        status=status,
        expected_value=None,
        actual_value=None,  # Date string doesn't fit float field
        variance=None,
        regulation_cite="29 C.F.R. § 5.5(a)(3)(ii)(B)",
        message=message
    )
