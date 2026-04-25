"""Unit tests for compliance check functions."""

import pytest

from wcp_backend.models.enums import CheckStatus, CheckType
from wcp_backend.models.schemas import DBWDRateRecord, EmployeeRecord
from wcp_backend.pipeline.checks.wage_check import check_wage
from wcp_backend.pipeline.checks.overtime_check import check_overtime
from wcp_backend.pipeline.checks.fringe_check import check_fringe
from wcp_backend.pipeline.checks.total_check import check_totals


class TestWageCheck:
    """Test prevailing wage compliance check."""
    
    def test_wage_passes_when_meets_minimum(self):
        """Test wage check passes when wage >= DBWD rate."""
        employee = EmployeeRecord(
            name="John Smith",
            trade_classification="Electrician",
            hours_worked=40,
            hourly_wage=51.69,
            fringe_benefits=34.63,
            gross_earnings=2067.60,
            deductions=150.00,
            net_wages=1917.60
        )
        dbwd_rate = DBWDRateRecord(
            trade="Electrician",
            locality="Washington, DC",
            rate=51.69,
            fringe=34.63,
            effective_date="2026-01-01"
        )
        
        result = check_wage(employee, dbwd_rate)
        
        assert result.status == CheckStatus.PASS
        assert result.check_type == CheckType.WAGE
        assert result.expected_value == pytest.approx(51.69)
        assert result.actual_value == pytest.approx(51.69)
        assert result.variance == pytest.approx(0.0)
        assert "40 U.S.C. § 3142" in result.regulation_cite
        assert "meets DBWD minimum" in result.message
    
    def test_wage_fails_when_below_minimum(self):
        """Test wage check fails when wage < DBWD rate."""
        employee = EmployeeRecord(
            name="John Smith",
            trade_classification="Electrician",
            hours_worked=40,
            hourly_wage=45.00,  # Below minimum
            fringe_benefits=34.63,
            gross_earnings=1800.00,
            deductions=150.00,
            net_wages=1650.00
        )
        dbwd_rate = DBWDRateRecord(
            trade="Electrician",
            locality="Washington, DC",
            rate=51.69,
            fringe=34.63,
            effective_date="2026-01-01"
        )
        
        result = check_wage(employee, dbwd_rate)
        
        assert result.status == CheckStatus.FAIL
        assert result.variance == pytest.approx(-6.69, abs=0.01)
        assert "violation" in result.message.lower()
    
    def test_wage_check_id_format(self):
        """Test that check_id follows the correct format."""
        employee = EmployeeRecord(
            name="John Smith",
            trade_classification="Electrician",
            hours_worked=40,
            hourly_wage=51.69,
            fringe_benefits=34.63,
            gross_earnings=2067.60,
            deductions=150.00,
            net_wages=1917.60
        )
        dbwd_rate = DBWDRateRecord(
            trade="Electrician",
            locality="Washington, DC",
            rate=51.69,
            fringe=34.63,
            effective_date="2026-01-01"
        )
        
        result = check_wage(employee, dbwd_rate)
        
        assert result.check_id == "wage_john_smith"


class TestOvertimeCheck:
    """Test overtime compliance check."""
    
    def test_overtime_passes_when_no_overtime(self):
        """Test overtime check passes when no OT hours worked."""
        employee = EmployeeRecord(
            name="Jane Doe",
            trade_classification="Plumber",
            hours_worked=40,
            overtime_hours=0,
            hourly_wage=48.50,
            fringe_benefits=32.25,
            gross_earnings=1940.00,
            deductions=150.00,
            net_wages=1790.00
        )
        
        result = check_overtime(employee)
        
        assert result.status == CheckStatus.PASS
        assert "No overtime" in result.message
    
    def test_overtime_passes_when_overtime_recorded(self):
        """Test overtime check passes when OT is properly recorded."""
        employee = EmployeeRecord(
            name="Jane Doe",
            trade_classification="Plumber",
            hours_worked=45,
            overtime_hours=5,
            hourly_wage=48.50,
            fringe_benefits=32.25,
            gross_earnings=2302.50,  # 40*48.50 + 5*48.50*1.5
            deductions=150.00,
            net_wages=2152.50
        )
        
        result = check_overtime(employee)
        
        assert result.status == CheckStatus.PASS
        assert "Overtime recorded" in result.message

    
    def test_overtime_warns_when_missing_ot(self):
        """Test overtime check warns when hours > 40 but no OT recorded."""
        employee = EmployeeRecord(
            name="Jane Doe",
            trade_classification="Plumber",
            hours_worked=45,
            overtime_hours=0,  # Missing OT
            hourly_wage=48.50,
            fringe_benefits=32.25,
            gross_earnings=2182.50,  # No OT premium
            deductions=150.00,
            net_wages=2032.50
        )
        
        result = check_overtime(employee)
        
        assert result.status == CheckStatus.WARNING
        assert "Warning" in result.message



class TestFringeCheck:
    """Test fringe benefits compliance check."""
    
    def test_fringe_passes_when_meets_minimum(self):
        """Test fringe check passes when total fringe >= DBWD fringe * hours."""
        # Carpenter: $28.50/hr fringe × 40 hrs = $1140.00 required
        employee = EmployeeRecord(
            name="Bob Johnson",
            trade_classification="Carpenter",
            hours_worked=40,
            hourly_wage=42.75,
            fringe_benefits=1140.00,  # Total fringe: exactly meets requirement
            gross_earnings=1710.00,
            deductions=150.00,
            net_wages=1560.00
        )
        dbwd_rate = DBWDRateRecord(
            trade="Carpenter",
            locality="Washington, DC",
            rate=42.75,
            fringe=28.50,
            effective_date="2026-01-01"
        )

        result = check_fringe(employee, dbwd_rate)

        assert result.status == CheckStatus.PASS
        assert result.expected_value == pytest.approx(1140.00, abs=0.01)  # 28.50 * 40
        assert result.actual_value == pytest.approx(1140.00)
        assert "40 U.S.C. § 3141(2)(B)" in result.regulation_cite
    
    def test_fringe_fails_when_below_minimum(self):
        """Test fringe check fails when total fringe < required amount."""
        # Carpenter: $28.50/hr fringe × 40 hrs = $1140.00 required
        employee = EmployeeRecord(
            name="Bob Johnson",
            trade_classification="Carpenter",
            hours_worked=40,
            hourly_wage=42.75,
            fringe_benefits=1000.00,  # Total fringe: $140 below requirement
            gross_earnings=1710.00,
            deductions=150.00,
            net_wages=1560.00
        )
        dbwd_rate = DBWDRateRecord(
            trade="Carpenter",
            locality="Washington, DC",
            rate=42.75,
            fringe=28.50,
            effective_date="2026-01-01"
        )

        result = check_fringe(employee, dbwd_rate)

        assert result.status == CheckStatus.FAIL
        assert result.variance == pytest.approx(-140.00, abs=0.01)  # 1000 - 1140 = -140


class TestTotalsCheck:
    """Test arithmetic total check."""
    
    def test_totals_passes_when_arithmetic_correct(self):
        """Test totals check passes when gross/net are correct."""
        # 40 hours at $50/hr = $2000 gross
        employee = EmployeeRecord(
            name="Test Employee",
            trade_classification="Laborer",
            hours_worked=40,
            hourly_wage=50.00,
            fringe_benefits=100.00,
            gross_earnings=2000.00,
            deductions=200.00,
            net_wages=1800.00
        )
        
        result = check_totals(employee)
        
        assert result.status == CheckStatus.PASS
        assert "Arithmetic correct" in result.message
    
    def test_totals_fails_when_gross_incorrect(self):
        """Test totals check fails when gross doesn't match hours*wage."""
        employee = EmployeeRecord(
            name="Test Employee",
            trade_classification="Laborer",
            hours_worked=40,
            hourly_wage=50.00,
            fringe_benefits=100.00,
            gross_earnings=2100.00,  # Should be 2000.00
            deductions=200.00,
            net_wages=1900.00
        )
        
        result = check_totals(employee)
        
        assert result.status == CheckStatus.FAIL
    
    def test_totals_with_overtime_calculation(self):
        """Test totals check with overtime hours."""
        # 40 hours base + 5 hours OT at $50/hr = 40*50 + 5*50*1.5 = 2000 + 375 = 2375
        employee = EmployeeRecord(
            name="Test Employee",
            trade_classification="Laborer",
            hours_worked=45,
            overtime_hours=5,
            hourly_wage=50.00,
            fringe_benefits=100.00,
            gross_earnings=2375.00,
            deductions=200.00,
            net_wages=2175.00
        )
        
        result = check_totals(employee)
        
        assert result.status == CheckStatus.PASS


class TestCheckTypeAndRegulationCites:
    """Test that all checks have correct types and regulation citations."""
    
    def test_wage_check_has_correct_regulation(self):
        """Test wage check cites Davis-Bacon Act."""
        employee = EmployeeRecord(
            name="Test",
            trade_classification="Electrician",
            hours_worked=40,
            hourly_wage=51.69,
            fringe_benefits=34.63,
            gross_earnings=2067.60,
            deductions=150.00,
            net_wages=1917.60
        )
        dbwd_rate = DBWDRateRecord(
            trade="Electrician",
            locality="Washington, DC",
            rate=51.69,
            fringe=34.63,
            effective_date="2026-01-01"
        )
        
        result = check_wage(employee, dbwd_rate)
        
        assert result.check_type == CheckType.WAGE
        assert "40 U.S.C. § 3142" in result.regulation_cite
    
    def test_fringe_check_has_correct_regulation(self):
        """Test fringe check cites Davis-Bacon Act fringe provision."""
        employee = EmployeeRecord(
            name="Test",
            trade_classification="Electrician",
            hours_worked=40,
            hourly_wage=51.69,
            fringe_benefits=1385.20,
            gross_earnings=2067.60,
            deductions=150.00,
            net_wages=1917.60
        )
        dbwd_rate = DBWDRateRecord(
            trade="Electrician",
            locality="Washington, DC",
            rate=51.69,
            fringe=34.63,
            effective_date="2026-01-01"
        )
        
        result = check_fringe(employee, dbwd_rate)
        
        assert result.check_type == CheckType.FRINGE
        assert "40 U.S.C. § 3141(2)(B)" in result.regulation_cite
