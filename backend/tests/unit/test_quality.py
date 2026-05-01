"""Tests for V4 quality validation module."""


from wcp_backend.quality import (
    ValidationResult,
    validate_contracts,
    validate_payroll_records,
    validate_dbwd_rates,
    is_valid_trade_code,
    is_valid_locality_code,
    is_friday,
)


class TestValidationResult:
    """Tests for ValidationResult class."""

    def test_success_result(self) -> None:
        result = ValidationResult(success=True, failed_count=0)
        assert result.success is True
        assert result.failed_count == 0
        assert result.errors == []
        assert bool(result) is True

    def test_failed_result(self) -> None:
        result = ValidationResult(
            success=False,
            failed_count=2,
            errors=[{"row": 1, "errors": ["missing field"]}],
        )
        assert result.success is False
        assert result.failed_count == 2
        assert bool(result) is False

    def test_model_dump(self) -> None:
        result = ValidationResult(
            success=False,
            failed_count=1,
            errors=[{"row": 1, "errors": ["bad data"]}],
            warnings=[{"row": 2, "warnings": ["soft warning"]}],
        )
        data = result.model_dump()
        assert data["success"] is False
        assert data["failed_count"] == 1
        assert len(data["errors"]) == 1
        assert len(data["warnings"]) == 1


class TestIsFriday:
    """Tests for is_friday helper."""

    def test_friday_returns_true(self) -> None:
        from datetime import date
        # 2025-04-04 is a Friday
        assert is_friday(date(2025, 4, 4)) is True

    def test_monday_returns_false(self) -> None:
        from datetime import date
        # 2025-04-07 is a Monday
        assert is_friday(date(2025, 4, 7)) is False


class TestIsValidTradeCode:
    """Tests for trade code validation."""

    def test_valid_codes(self) -> None:
        for code in ["ELEC", "PLUMB", "BRICK", "CARP", "HVAC"]:
            assert is_valid_trade_code(code) is True

    def test_invalid_codes(self) -> None:
        assert is_valid_trade_code("INVALID") is False
        assert is_valid_trade_code("") is False

    def test_case_insensitive(self) -> None:
        assert is_valid_trade_code("elec") is True
        assert is_valid_trade_code("Elec") is True


class TestIsValidLocalityCode:
    """Tests for locality code validation."""

    def test_valid_state_codes(self) -> None:
        for state in ["CA", "NY", "TX", "MA", "DC"]:
            assert is_valid_locality_code(state) is True

    def test_valid_city_state_format(self) -> None:
        assert is_valid_locality_code("Boston, MA") is True
        assert is_valid_locality_code("Denver, CO") is True

    def test_invalid_locality(self) -> None:
        assert is_valid_locality_code("") is False
        assert is_valid_locality_code("ZZ") is False


class TestValidateContracts:
    """Tests for contract validation."""

    def test_valid_contract_passes(self) -> None:
        contracts = [
            {
                "contract_number": "GS-001",
                "project_name": "Test Project",
                "contractor_name": "Test Contractor",
                "locality": "Boston, MA",
                "start_date": "2025-01-01",
            }
        ]
        result = validate_contracts(contracts)
        assert result.success is True
        assert result.failed_count == 0

    def test_missing_required_field_fails(self) -> None:
        contracts = [
            {
                "contract_number": "GS-001",
                "project_name": "Test Project",
                # missing contractor_name and locality
                "start_date": "2025-01-01",
            }
        ]
        result = validate_contracts(contracts)
        assert result.success is False
        assert result.failed_count == 1
        assert "missing required field" in result.errors[0]["errors"][0]

    def test_duplicate_contract_number_fails(self) -> None:
        contracts = [
            {
                "contract_number": "GS-001",
                "project_name": "Test Project",
                "contractor_name": "Test Contractor",
                "locality": "Boston, MA",
                "start_date": "2025-01-01",
            },
            {
                "contract_number": "GS-001",
                "project_name": "Duplicate Project",
                "contractor_name": "Test Contractor",
                "locality": "Boston, MA",
                "start_date": "2025-02-01",
            },
        ]
        result = validate_contracts(contracts)
        assert result.success is False
        assert result.failed_count == 1
        assert "duplicate contract_number" in result.errors[0]["errors"][0]

    def test_future_start_date_fails(self) -> None:
        from datetime import date
        future = (date.today().year + 1, 1, 1)
        contracts = [
            {
                "contract_number": "GS-002",
                "project_name": "Future Project",
                "contractor_name": "Test Contractor",
                "locality": "Boston, MA",
                "start_date": f"{future[0]}-{future[1]:02d}-{future[2]:02d}",
            }
        ]
        result = validate_contracts(contracts)
        assert result.success is False
        assert result.failed_count == 1
        assert "future" in result.errors[0]["errors"][0]

    def test_empty_list_passes(self) -> None:
        result = validate_contracts([])
        assert result.success is True

    def test_negative_total_value_fails(self) -> None:
        contracts = [
            {
                "contract_number": "GS-003",
                "project_name": "Bad Project",
                "contractor_name": "Test Contractor",
                "locality": "Boston, MA",
                "start_date": "2025-01-01",
                "total_value": -100.0,
            }
        ]
        result = validate_contracts(contracts)
        assert result.success is False


class TestValidatePayrollRecords:
    """Tests for payroll record validation."""

    def test_valid_payroll_passes(self) -> None:
        records = [
            {
                "employee_name": "John Doe",
                "trade_code": "ELEC",
                "locality_code": "Boston, MA",
                "week_ending": "2025-04-04",  # Friday
                "total_hours": 40.0,
                "hourly_rate": 50.0,
                "gross_pay": 2000.0,
            }
        ]
        result = validate_payroll_records(records)
        assert result.success is True
        assert result.failed_count == 0

    def test_missing_required_field_fails(self) -> None:
        records = [
            {
                "employee_name": "John Doe",
                "trade_code": "ELEC",
                # missing week_ending, total_hours, hourly_rate, gross_pay
            }
        ]
        result = validate_payroll_records(records)
        assert result.success is False
        assert result.failed_count == 1

    def test_hours_over_168_fails(self) -> None:
        records = [
            {
                "employee_name": "John Doe",
                "trade_code": "ELEC",
                "week_ending": "2025-04-04",
                "total_hours": 200.0,
                "hourly_rate": 50.0,
                "gross_pay": 10000.0,
            }
        ]
        result = validate_payroll_records(records)
        assert result.success is False

    def test_negative_hourly_rate_fails(self) -> None:
        records = [
            {
                "employee_name": "John Doe",
                "trade_code": "ELEC",
                "week_ending": "2025-04-04",
                "total_hours": 40.0,
                "hourly_rate": -10.0,
                "gross_pay": -400.0,
            }
        ]
        result = validate_payroll_records(records)
        assert result.success is False

    def test_empty_employee_name_fails(self) -> None:
        records = [
            {
                "employee_name": "   ",
                "trade_code": "ELEC",
                "week_ending": "2025-04-04",
                "total_hours": 40.0,
                "hourly_rate": 50.0,
                "gross_pay": 2000.0,
            }
        ]
        result = validate_payroll_records(records)
        assert result.success is False

    def test_non_friday_week_ending_warns(self) -> None:
        from datetime import date
        # Find a non-Friday date
        non_friday = date(2025, 4, 7)  # Monday
        records = [
            {
                "employee_name": "John Doe",
                "trade_code": "ELEC",
                "week_ending": non_friday.isoformat(),
                "total_hours": 40.0,
                "hourly_rate": 50.0,
                "gross_pay": 2000.0,
            }
        ]
        result = validate_payroll_records(records)
        # Should pass validation but with warnings
        assert result.success is True
        assert len(result.warnings) == 1

    def test_empty_list_passes(self) -> None:
        result = validate_payroll_records([])
        assert result.success is True


class TestValidateDBWDRates:
    """Tests for DBWD rate validation."""

    def test_valid_rate_passes(self) -> None:
        rates = [
            {
                "rate_key": "ELEC-Boston-MA-2025",
                "trade_code": "ELEC",
                "locality_code": "Boston, MA",
                "wage": 51.69,
            }
        ]
        result = validate_dbwd_rates(rates)
        assert result.success is True

    def test_negative_wage_fails(self) -> None:
        rates = [
            {
                "rate_key": "ELEC-Boston-MA-2025",
                "trade_code": "ELEC",
                "locality_code": "Boston, MA",
                "wage": -10.0,
            }
        ]
        result = validate_dbwd_rates(rates)
        assert result.success is False

    def test_missing_required_field_fails(self) -> None:
        rates = [
            {
                "rate_key": "ELEC-Boston-MA-2025",
                "trade_code": "ELEC",
                # missing locality_code and wage
            }
        ]
        result = validate_dbwd_rates(rates)
        assert result.success is False

    def test_wage_over_500_fails(self) -> None:
        rates = [
            {
                "rate_key": "ELEC-Boston-MA-2025",
                "trade_code": "ELEC",
                "locality_code": "Boston, MA",
                "wage": 600.0,
            }
        ]
        result = validate_dbwd_rates(rates)
        assert result.success is False

    def test_empty_list_passes(self) -> None:
        result = validate_dbwd_rates([])
        assert result.success is True