"""Integration test configuration — shared fixtures for API endpoint tests."""

import pytest


@pytest.fixture
def sample_wh347_text() -> str:
    """Complete WH-347 text payload for extraction tests."""
    return """
    Contractor: ABC Construction
    Project: Federal Building Renovation
    Location: Washington, DC
    Certified: 2026-01-15
    Payroll # 1
    Week Ending: 2026-01-15

    Name: John Smith
    Trade: Electrician
    Hours: 40
    Hourly Wage: 51.69
    Fringe: 1385.20
    Gross: 2067.60
    Deductions: 150.00
    Net: 1917.60
    """


@pytest.fixture
def sample_wh347_violation_text() -> str:
    """WH-347 text with wage violation (below DBWD minimum)."""
    return """
    Contractor: XYZ Contractors
    Project: Highway Project
    Location: Washington, DC
    Certified: 2026-01-15

    Name: Jane Doe
    Trade: Electrician
    Hours: 40
    Hourly Wage: 40.00
    Fringe: 1000.00
    Gross: 1600.00
    Deductions: 100.00
    Net: 1500.00
    """


@pytest.fixture
def sample_wh347_fringe_violation_text() -> str:
    """WH-347 text with fringe violation (below DBWD minimum)."""
    return """
    Contractor: ABC Construction
    Project: Federal Building
    Location: Washington, DC
    Certified: 2026-01-15

    Name: Bob Wilson
    Trade: Electrician
    Hours: 40
    Hourly Wage: 51.69
    Fringe: 500.00
    Gross: 2567.60
    Deductions: 150.00
    Net: 2417.60
    """


@pytest.fixture
def sample_wh347_unknown_trade_text() -> str:
    """WH-347 text with unknown/unresolvable trade classification."""
    return """
    Contractor: Test Co
    Project: Test Project
    Location: Washington, DC
    Certified: 2026-01-15

    Name: Unknown Worker
    Trade: XYZSpecialist123
    Hours: 40
    Hourly Wage: 50.00
    Fringe: 1000.00
    Gross: 2000.00
    Deductions: 100.00
    Net: 1900.00
    """


@pytest.fixture
def sample_wh347_no_certification_text() -> str:
    """WH-347 text without certification date."""
    return """
    Contractor: NoCert Corp
    Project: Uncertified Project
    Location: Washington, DC

    Name: No Cert Smith
    Trade: Plumber
    Hours: 40
    Hourly Wage: 48.50
    Fringe: 1290.00
    Gross: 1940.00
    Deductions: 100.00
    Net: 1840.00
    """


@pytest.fixture
def mock_pdf_bytes() -> bytes:
    """Minimal valid PDF bytes for testing (not a real PDF, just for mocking)."""
    return b"%PDF-1.4 mock pdf content"
