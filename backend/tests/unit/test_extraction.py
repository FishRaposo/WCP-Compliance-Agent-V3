"""Unit tests for WH-347 data extraction."""

import pytest

from wcp_backend.pipeline.extraction import (
    extract_from_text,
    resolve_classification,
    IN_MEMORY_ALIASES,
    _extract_float,
    _extract_pattern,
)


class TestResolveClassification:
    """Test trade classification aliasing."""
    
    @pytest.mark.parametrize("raw_input,expected", [
        ("ELEC", "Electrician"),
        ("electrician", "Electrician"),
        ("electrical", "Electrician"),
        ("electrical worker", "Electrician"),
        ("PLUM", "Plumber"),
        ("plumbing", "Plumber"),
        ("CARP", "Carpenter"),
        ("carpentry", "Carpenter"),
        ("LABOR", "Laborer"),
        ("general laborer", "Laborer"),
        ("helper", "Laborer"),
        ("HVAC", "HVAC Technician"),
        ("ac tech", "HVAC Technician"),
        ("Electrician", "Electrician"),  # Already canonical
        ("Plumber", "Plumber"),  # Already canonical
    ])
    def test_alias_resolution(self, raw_input, expected):
        """Test that trade aliases resolve correctly."""
        result = resolve_classification(raw_input)
        assert result == expected
    
    def test_unknown_trade_returns_original(self):
        """Test that unknown trades return the original input."""
        unknown = "UnknownTrade"
        result = resolve_classification(unknown)
        assert result == unknown


class TestExtractPattern:
    """Test regex pattern extraction helpers."""
    
    def test_extract_pattern_finds_match(self):
        """Test basic pattern extraction."""
        text = "Name: John Smith"
        result = _extract_pattern(text, r"Name:\s+(.+)")
        assert result == "John Smith"
    
    def test_extract_pattern_no_match_returns_none(self):
        """Test that non-matching pattern returns None."""
        text = "No name here"
        result = _extract_pattern(text, r"Name:\s+(.+)")
        assert result is None
    
    def test_extract_pattern_case_insensitive(self):
        """Test that extraction is case insensitive."""
        text = "NAME: Jane Doe"
        result = _extract_pattern(text, r"name:\s+(.+)")
        assert result == "Jane Doe"


class TestExtractFloat:
    """Test float extraction from text."""
    
    @pytest.mark.parametrize("text,expected", [
        ("Wage: 51.69", 51.69),
        ("Wage: $51.69", 51.69),
        ("Wage: $51.69/hr", 51.69),
        ("Gross: $2,067.60", 2067.60),
        ("Hours: 40", 40.0),
    ])
    def test_extract_float_various_formats(self, text, expected):
        """Test extracting float from various currency formats."""
        result = _extract_float(text, r"(?:wage|gross|hours)[:\s]*\$?(\d[\d,]*\.?\d*)")
        assert result == expected
    
    def test_extract_float_no_match_returns_none(self):
        """Test that missing value returns None."""
        text = "No wage here"
        result = _extract_float(text, r"wage[:\s]*(\d+\.?\d*)")
        assert result is None


class TestExtractFromText:
    """Test full text extraction."""
    
    def test_extract_simple_employee(self):
        """Test extracting a simple employee record."""
        text = """
        Contractor: ABC Construction
        Project: Federal Building Renovation
        Location: Washington, DC
        
        Name: John Smith
        Trade: Electrician
        Hours: 40
        Hourly Wage: 51.69
        Fringe: 34.63
        Gross: 2067.60
        Deductions: 150.00
        Net: 1917.60
        
        Certified: 2026-01-15
        Payroll # 42
        """
        
        result = extract_from_text(text)
        
        assert result.contractor.name == "ABC Construction"
        assert result.project.name == "Federal Building Renovation"
        assert result.project.location == "Washington, DC"
        assert len(result.employees) == 1
        
        emp = result.employees[0]
        assert emp.name == "John Smith"
        assert emp.trade_classification == "Electrician"
        assert emp.hours_worked == 40.0
        assert emp.hourly_wage == 51.69
        assert emp.fringe_benefits == 34.63
        assert emp.gross_earnings == 2067.60
        assert emp.net_wages == 1917.60
    
    def test_extract_with_trade_alias(self):
        """Test that trade aliases are resolved during extraction."""
        text = """
        Name: Bob Johnson
        Trade: ELEC
        Hours: 40
        Wage: 51.69
        Fringe: 34.63
        Gross: 2067.60
        Net: 1917.60
        """
        
        result = extract_from_text(text)
        
        assert len(result.employees) == 1
        assert result.employees[0].trade_classification == "Electrician"
    
    def test_extract_multiple_employees(self):
        """Test extracting multiple employee records."""
        text = """
        Name: John Smith
        Trade: Electrician
        Hours: 40
        Wage: 51.69
        Fringe: 34.63
        Gross: 2067.60
        Net: 1917.60
        
        Name: Jane Doe
        Trade: Plumber
        Hours: 40
        Wage: 48.50
        Fringe: 32.25
        Gross: 1940.00
        Net: 1790.00
        """
        
        result = extract_from_text(text)
        
        assert len(result.employees) == 2
        assert result.employees[0].name == "John Smith"
        assert result.employees[1].name == "Jane Doe"
    
    def test_extract_with_overtime(self):
        """Test extracting employee with overtime hours."""
        text = """
        Name: Mike Brown
        Trade: Carpenter
        Hours: 45
        Overtime: 5
        Wage: 42.75
        Fringe: 28.50
        Gross: 2137.50
        Net: 1987.50
        """
        
        result = extract_from_text(text)
        
        assert len(result.employees) == 1
        assert result.employees[0].hours_worked == 45.0
        assert result.employees[0].overtime_hours == 5.0
    
    def test_extract_generates_job_id(self):
        """Test that extraction generates a unique job ID."""
        text = "Name: Test Employee"
        
        result1 = extract_from_text(text)
        result2 = extract_from_text(text)
        
        assert result1.job_id != result2.job_id
        assert len(result1.job_id) == 36  # UUID format
    
    def test_extract_defaults_for_missing_fields(self):
        """Test handling of missing optional fields."""
        text = "Name: Minimal Employee"
        
        result = extract_from_text(text)
        
        assert result.contractor.name == "Unknown Contractor"
        assert result.project.name == "Unknown Project"
        assert result.project.location == "Washington, DC"
        assert len(result.employees) == 1
        
        emp = result.employees[0]
        assert emp.trade_classification == "Laborer"  # Default
        assert emp.hours_worked == 40.0  # Default
        assert result.certification_date is None


class TestINMemoryAliases:
    """Test the alias mapping completeness."""
    
    def test_all_canonical_trades_present(self):
        """Test that all 20 canonical trades have at least one alias."""
        expected_trades = {
            "Electrician", "Plumber", "Carpenter", "Laborer",
            "Equipment Operator", "Ironworker", "Painter", "Sheet Metal Worker",
            "HVAC Technician", "Welder", "Mason", "Roofer",
            "Glazier", "Insulation Worker", "Tile Setter", "Drywall Installer",
            "Concrete Finisher", "Surveyor", "Flagger", "Truck Driver"
        }
        
        canonical_in_aliases = set(IN_MEMORY_ALIASES.values())
        
        for trade in expected_trades:
            assert trade in canonical_in_aliases, f"Trade '{trade}' not in aliases"
    
    def test_at_least_40_aliases(self):
        """Test that we have at least 40 alias mappings (2 per trade minimum)."""
        assert len(IN_MEMORY_ALIASES) >= 40
