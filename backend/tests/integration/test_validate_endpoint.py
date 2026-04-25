"""Integration tests for POST /validate endpoint."""

import pytest


class TestValidateEndpoint:
    """Test suite for the validation API endpoint."""

    @pytest.fixture
    def clean_electrician_payload(self):
        """Valid WCP payload that should pass all checks."""
        return {
            "job_id": "test-clean-001",
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
                    "hourly_wage": 51.69,  # Exact DBWD rate
                    "fringe_benefits": 1385.20,  # 34.63 * 40
                    "gross_earnings": 2067.60,  # 40 * 51.69
                    "deductions": 200.00,
                    "net_wages": 1867.60,
                }
            ],
            "certification_date": "2026-01-15",
            "payroll_number": 1,
            "week_ending": "2026-01-15",
        }

    def test_validate_clean_wcp(self, client, clean_electrician_payload):
        """POST /validate with valid WCP returns all PASS."""
        response = client.post("/validate", json=clean_electrician_payload)

        assert response.status_code == 200
        body = response.json()

        # Overall status should be pass
        assert body["overall_status"] == "pass"
        assert body["violation_count"] == 0

        # All individual checks should pass
        check_statuses = {c["check_type"]: c["status"] for c in body["checks"]}
        assert check_statuses.get("wage_check") == "pass"
        assert check_statuses.get("fringe_check") == "pass"
        assert check_statuses.get("overtime_check") == "pass"
        assert check_statuses.get("signature_check") == "pass"
        assert check_statuses.get("total_check") == "pass"

    def test_validate_wage_violation(self, client):
        """Wage below DBWD minimum returns FAIL."""
        payload = {
            "job_id": "test-wage-violation",
            "contractor": {"name": "Bad Contractor", "address": "", "ein": ""},
            "project": {"name": "Test", "location": "Washington, DC", "contract_number": "", "wage_determination_number": ""},
            "employees": [
                {
                    "name": "Underpaid Worker",
                    "trade_classification": "Electrician",
                    "hours_worked": 40.0,
                    "overtime_hours": 0.0,
                    "hourly_wage": 40.00,  # Below $51.69 minimum
                    "fringe_benefits": 1385.20,
                    "gross_earnings": 1600.00,
                    "deductions": 100.00,
                    "net_wages": 1500.00,
                }
            ],
            "certification_date": "2026-01-15",
            "payroll_number": 1,
            "week_ending": "2026-01-15",
        }

        response = client.post("/validate", json=payload)

        assert response.status_code == 200
        body = response.json()

        # Should have violations
        assert body["overall_status"] == "fail"
        assert body["violation_count"] >= 1

        # Find wage check
        wage_check = next((c for c in body["checks"] if c["check_type"] == "wage_check"), None)
        assert wage_check is not None
        assert wage_check["status"] == "fail"
        assert "violation" in wage_check["message"].lower() or "below" in wage_check["message"].lower()

    def test_validate_fringe_violation(self, client):
        """Fringe below DBWD minimum returns FAIL."""
        payload = {
            "job_id": "test-fringe-violation",
            "contractor": {"name": "Test", "address": "", "ein": ""},
            "project": {"name": "Test", "location": "Washington, DC", "contract_number": "", "wage_determination_number": ""},
            "employees": [
                {
                    "name": "Low Fringe Worker",
                    "trade_classification": "Electrician",
                    "hours_worked": 40.0,
                    "overtime_hours": 0.0,
                    "hourly_wage": 51.69,
                    "fringe_benefits": 500.00,  # Below 34.63 * 40 = 1385.20
                    "gross_earnings": 2567.60,
                    "deductions": 150.00,
                    "net_wages": 2417.60,
                }
            ],
            "certification_date": "2026-01-15",
            "payroll_number": 1,
            "week_ending": "2026-01-15",
        }

        response = client.post("/validate", json=payload)

        assert response.status_code == 200
        body = response.json()

        # Find fringe check
        fringe_check = next((c for c in body["checks"] if c["check_type"] == "fringe_check"), None)
        assert fringe_check is not None
        assert fringe_check["status"] == "fail"

    def test_validate_unknown_trade(self, client):
        """Unknown trade returns classification FAIL."""
        payload = {
            "job_id": "test-unknown-trade",
            "contractor": {"name": "Test", "address": "", "ein": ""},
            "project": {"name": "Test", "location": "Washington, DC", "contract_number": "", "wage_determination_number": ""},
            "employees": [
                {
                    "name": "Unknown Trade Worker",
                    "trade_classification": "XYZSpecialist123",
                    "hours_worked": 40.0,
                    "overtime_hours": 0.0,
                    "hourly_wage": 50.00,
                    "fringe_benefits": 1000.00,
                    "gross_earnings": 2000.00,
                    "deductions": 100.00,
                    "net_wages": 1900.00,
                }
            ],
            "certification_date": "2026-01-15",
            "payroll_number": 1,
            "week_ending": "2026-01-15",
        }

        response = client.post("/validate", json=payload)

        assert response.status_code == 200
        body = response.json()

        # Should fail due to unknown trade (can't verify wage/fringe)
        assert body["overall_status"] == "fail"

        # Should have a classification check
        class_check = next((c for c in body["checks"] if c["check_type"] == "classification_check"), None)
        assert class_check is not None
        assert class_check["status"] == "fail"

    def test_validate_missing_certification(self, client):
        """Missing certification_date returns signature FAIL."""
        payload = {
            "job_id": "test-no-cert",
            "contractor": {"name": "Test", "address": "", "ein": ""},
            "project": {"name": "Test", "location": "Washington, DC", "contract_number": "", "wage_determination_number": ""},
            "employees": [
                {
                    "name": "No Cert Worker",
                    "trade_classification": "Plumber",
                    "hours_worked": 40.0,
                    "overtime_hours": 0.0,
                    "hourly_wage": 48.50,
                    "fringe_benefits": 1290.00,
                    "gross_earnings": 1940.00,
                    "deductions": 100.00,
                    "net_wages": 1840.00,
                }
            ],
            "certification_date": None,  # Missing!
            "payroll_number": 1,
            "week_ending": "2026-01-15",
        }

        response = client.post("/validate", json=payload)

        assert response.status_code == 200
        body = response.json()

        # Find signature check
        sig_check = next((c for c in body["checks"] if c["check_type"] == "signature_check"), None)
        assert sig_check is not None
        assert sig_check["status"] == "fail"
