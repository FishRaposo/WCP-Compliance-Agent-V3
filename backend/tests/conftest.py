"""Root test configuration — shared fixtures for all test scopes.

Note: app and TestClient are imported lazily inside fixtures so unit tests
can run without opentelemetry/observability packages installed.
"""

import pytest


@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    from wcp_backend.main import app
    return TestClient(app)


@pytest.fixture
def sample_extracted_wcp() -> dict:
    return {
        "job_id": "test-001",
        "contractor": {"name": "Acme Construction", "address": "123 Main St", "ein": "12-3456789"},
        "project": {
            "name": "Federal Building Renovation",
            "location": "Washington, DC",
            "contract_number": "GS-001-2026",
            "wage_determination_number": "WD 2025-0001",
        },
        "employees": [
            {
                "name": "John Doe",
                "trade_classification": "Electrician",
                "hours_worked": 40.0,
                "overtime_hours": 0.0,
                "hourly_wage": 51.69,
                "fringe_benefits": 1385.20,
                "gross_earnings": 2067.60,
                "deductions": 200.00,
                "net_wages": 1867.60,
            }
        ],
        "certification_date": "2026-04-18",
        "payroll_number": 1,
        "week_ending": "2026-04-18",
    }


@pytest.fixture
def sample_dbwd_rate() -> dict:
    return {
        "trade": "Electrician",
        "locality": "Washington, DC",
        "rate": 51.69,
        "fringe": 34.63,
        "effective_date": "2025-01-01",
        "wage_determination_number": "WD 2025-0001",
    }
