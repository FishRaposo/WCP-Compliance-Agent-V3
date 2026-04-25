"""Unit tests for rule engine and trust scoring."""

import pytest

from wcp_backend.models.enums import CheckStatus, CheckType, OverallStatus, TrustBand, VerdictStatus
from wcp_backend.models.schemas import ComplianceCheck, DeterministicReport, EmployeeRecord, ExtractedWCP, LLMVerdict
from wcp_backend.pipeline.rules import (
    compute_trust_components,
    compute_trust_score,
    determine_trust_band,
    _compute_agreement,
    run_rule_engine,
)


class TestRunRuleEngine:
    """Test the rule engine end-to-end."""
    
    @pytest.mark.asyncio
    async def test_rule_engine_runs_all_checks(self):
        """Test that rule engine runs all checks for all employees."""
        extracted = ExtractedWCP(
            job_id="test-001",
            contractor={"name": "Test Contractor", "address": "", "ein": ""},
            project={
                "name": "Test Project",
                "location": "Washington, DC",
                "contract_number": "",
                "wage_determination_number": "",
            },
            employees=[
                EmployeeRecord(
                    name="John Smith",
                    trade_classification="Electrician",
                    hours_worked=40,
                    hourly_wage=51.69,
                    fringe_benefits=1385.20,  # 34.63 * 40
                    gross_earnings=2067.60,
                    deductions=150.00,
                    net_wages=1917.60
                )
            ],
            certification_date="2026-01-15"
        )
        
        result = await run_rule_engine(extracted)
        
        assert isinstance(result, DeterministicReport)
        assert result.job_id == "test-001"
        assert len(result.checks) >= 7  # Multiple checks per employee
        assert len(result.dbwd_rates_used) == 1
    
    @pytest.mark.asyncio
    async def test_rule_engine_detects_violations(self):
        """Test that rule engine correctly identifies violations."""
        extracted = ExtractedWCP(
            job_id="test-002",
            contractor={"name": "Test Contractor", "address": "", "ein": ""},
            project={
                "name": "Test Project",
                "location": "Washington, DC",
                "contract_number": "",
                "wage_determination_number": "",
            },
            employees=[
                EmployeeRecord(
                    name="John Smith",
                    trade_classification="Electrician",
                    hours_worked=40,
                    hourly_wage=40.00,  # Below DBWD minimum of 51.69
                    fringe_benefits=1000.00,
                    gross_earnings=1600.00,
                    deductions=150.00,
                    net_wages=1450.00
                )
            ],
            certification_date="2026-01-15"
        )
        
        result = await run_rule_engine(extracted)
        
        assert result.violation_count > 0
        assert result.overall_status == OverallStatus.FAIL
        
        # Find the wage check
        wage_checks = [c for c in result.checks if c.check_type == CheckType.WAGE]
        assert len(wage_checks) == 1
        assert wage_checks[0].status == CheckStatus.FAIL
    
    @pytest.mark.asyncio
    async def test_rule_engine_multiple_employees(self):
        """Test rule engine with multiple employees."""
        extracted = ExtractedWCP(
            job_id="test-003",
            contractor={"name": "Test Contractor", "address": "", "ein": ""},
            project={"name": "Test Project", "location": "Washington, DC", "contract_number": "", "wage_determination_number": ""},
            employees=[
                EmployeeRecord(
                    name="John Smith",
                    trade_classification="Electrician",
                    hours_worked=40,
                    hourly_wage=51.69,
                    fringe_benefits=1385.20,
                    gross_earnings=2067.60,
                    deductions=150.00,
                    net_wages=1917.60
                ),
                EmployeeRecord(
                    name="Jane Doe",
                    trade_classification="Plumber",
                    hours_worked=40,
                    hourly_wage=48.50,
                    fringe_benefits=1290.00,
                    gross_earnings=1940.00,
                    deductions=150.00,
                    net_wages=1790.00
                )
            ],
            certification_date="2026-01-15"
        )
        
        result = await run_rule_engine(extracted)
        
        # Should have checks for both employees
        employee_names = {c.employee_name for c in result.checks if c.employee_name not in ("_all_", "_multiple_")}
        assert "John Smith" in employee_names
        assert "Jane Doe" in employee_names
        
        # Should only fetch 2 unique DBWD rates
        assert len(result.dbwd_rates_used) == 2

    @pytest.mark.asyncio
    async def test_unknown_trade_fails_overall_status(self):
        """Test that unverified DBWD classifications cannot pass overall validation."""
        extracted = ExtractedWCP(
            job_id="test-004",
            contractor={"name": "Test Contractor", "address": "", "ein": ""},
            project={"name": "Test Project", "location": "Washington, DC", "contract_number": "", "wage_determination_number": ""},
            employees=[
                EmployeeRecord(
                    name="John Smith",
                    trade_classification="UnknownTradeXYZ",
                    hours_worked=40,
                    hourly_wage=100.00,
                    fringe_benefits=2000.00,
                    gross_earnings=4000.00,
                    deductions=150.00,
                    net_wages=3850.00
                )
            ],
            certification_date="2026-01-15"
        )

        result = await run_rule_engine(extracted)

        classification_checks = [c for c in result.checks if c.check_type == CheckType.CLASSIFICATION]
        assert result.overall_status == OverallStatus.FAIL
        assert result.violation_count >= 1
        assert classification_checks[0].status == CheckStatus.FAIL

    @pytest.mark.asyncio
    async def test_missing_certification_date_fails_overall_status(self):
        """Test that missing certification dates fail signature validation."""
        extracted = ExtractedWCP(
            job_id="test-005",
            contractor={"name": "Test Contractor", "address": "", "ein": ""},
            project={"name": "Test Project", "location": "Washington, DC", "contract_number": "", "wage_determination_number": ""},
            employees=[
                EmployeeRecord(
                    name="John Smith",
                    trade_classification="Electrician",
                    hours_worked=40,
                    hourly_wage=51.69,
                    fringe_benefits=1385.20,
                    gross_earnings=2067.60,
                    deductions=150.00,
                    net_wages=1917.60
                )
            ],
            certification_date=None
        )

        result = await run_rule_engine(extracted)

        signature_checks = [c for c in result.checks if c.check_type == CheckType.SIGNATURE]
        assert result.overall_status == OverallStatus.FAIL
        assert signature_checks[0].status == CheckStatus.FAIL


class TestTrustScoreCalculation:
    """Test trust score computation."""
    
    def test_trust_components_sum_to_trust_score(self):
        """Test that components sum to total trust score."""
        deterministic = DeterministicReport(
            job_id="test",
            checks=[],
            overall_status=OverallStatus.PASS,
            violation_count=0,
            warning_count=0,
            dbwd_rates_used=[]
        )
        llm_verdict = LLMVerdict(
            job_id="test",
            verdict=VerdictStatus.APPROVED,
            reasoning="All checks passed",
            citations=[],
            confidence=0.9,
            rag_context_used=False,
            model="gpt-4o",
            prompt_version="v2",
            langfuse_trace_id="",
            token_usage=None
        )
        
        components = compute_trust_components(deterministic, llm_verdict)
        total_score = compute_trust_score(components)
        
        # Components should sum to total
        assert sum(components.values()) == pytest.approx(total_score, 0.001)
    
    def test_perfect_score_scenario(self):
        """Test trust score with perfect conditions."""
        # All checks pass, high LLM confidence, agreement
        deterministic = DeterministicReport(
            job_id="test",
            checks=[],
            overall_status=OverallStatus.PASS,
            violation_count=0,
            warning_count=0,
            dbwd_rates_used=[]
        )
        llm_verdict = LLMVerdict(
            job_id="test",
            verdict=VerdictStatus.APPROVED,
            reasoning="All checks passed",
            citations=[],
            confidence=1.0,
            rag_context_used=False,
            model="gpt-4o",
            prompt_version="v2",
            langfuse_trace_id="",
            token_usage=None
        )
        
        components = compute_trust_components(deterministic, llm_verdict)
        
        # With perfect conditions:
        # - deterministic: 0.35 * 1.0 = 0.35
        # - classification: 0.25 * 0.95 = 0.2375
        # - llm_self: 0.20 * 1.0 = 0.20
        # - agreement: 0.20 * 1.0 = 0.20
        # Total: 0.9875
        assert components["deterministic"] == pytest.approx(0.35, 0.001)
        assert components["llm_self"] == pytest.approx(0.20, 0.001)
        assert components["agreement"] == pytest.approx(0.20, 0.001)
    
    def test_violations_reduce_deterministic_component(self):
        """Test that violations reduce the deterministic component."""
        _fail_check = ComplianceCheck(
            check_id="wage_test",
            check_type=CheckType.WAGE,
            employee_name="Test",
            status=CheckStatus.FAIL,
            regulation_cite="40 U.S.C. § 3142",
            message="Violation"
        )
        deterministic = DeterministicReport(
            job_id="test",
            checks=[_fail_check for _ in range(4)],
            overall_status=OverallStatus.FAIL,
            violation_count=4,
            warning_count=0,
            dbwd_rates_used=[]
        )
        llm_verdict = LLMVerdict(
            job_id="test",
            verdict=VerdictStatus.REJECTED,
            reasoning="Violations found",
            citations=[],
            confidence=0.8,
            rag_context_used=False,
            model="gpt-4o",
            prompt_version="v2",
            langfuse_trace_id="",
            token_usage=None
        )
        
        components = compute_trust_components(deterministic, llm_verdict)
        
        # With all checks failing:
        # - deterministic: 0.35 * 0.0 = 0.0
        assert components["deterministic"] == pytest.approx(0.0, 0.001)


class TestDetermineTrustBand:
    """Test trust band determination."""
    
    @pytest.mark.parametrize("score,expected_band", [
        (0.90, TrustBand.AUTO_APPROVE),
        (0.85, TrustBand.AUTO_APPROVE),
        (0.84, TrustBand.FLAG_FOR_REVIEW),
        (0.70, TrustBand.FLAG_FOR_REVIEW),
        (0.60, TrustBand.FLAG_FOR_REVIEW),
        (0.59, TrustBand.REQUIRE_HUMAN_REVIEW),
        (0.30, TrustBand.REQUIRE_HUMAN_REVIEW),
        (0.00, TrustBand.REQUIRE_HUMAN_REVIEW),
    ])
    def test_trust_band_boundaries(self, score, expected_band):
        """Test trust band boundaries."""
        result = determine_trust_band(score)
        assert result == expected_band


class TestComputeAgreement:
    """Test agreement calculation between deterministic and LLM."""
    
    def test_agreement_full_when_no_violations_and_approved(self):
        """Test 1.0 agreement when no violations and LLM approves."""
        deterministic = DeterministicReport(
            job_id="test",
            checks=[],
            overall_status=OverallStatus.PASS,
            violation_count=0,
            warning_count=0,
            dbwd_rates_used=[]
        )
        llm_verdict = LLMVerdict(
            job_id="test",
            verdict=VerdictStatus.APPROVED,
            reasoning="Good",
            citations=[],
            confidence=0.9,
            rag_context_used=False,
            model="gpt-4o",
            prompt_version="v2",
            langfuse_trace_id="",
            token_usage=None
        )
        
        result = _compute_agreement(deterministic, llm_verdict)
        assert result == 1.0
    
    def test_agreement_zero_when_violations_but_approved(self):
        """Test 0.0 agreement when violations exist but LLM approves."""
        deterministic = DeterministicReport(
            job_id="test",
            checks=[],
            overall_status=OverallStatus.FAIL,
            violation_count=2,
            warning_count=0,
            dbwd_rates_used=[]
        )
        llm_verdict = LLMVerdict(
            job_id="test",
            verdict=VerdictStatus.APPROVED,
            reasoning="Mistake",
            citations=[],
            confidence=0.5,
            rag_context_used=False,
            model="gpt-4o",
            prompt_version="v2",
            langfuse_trace_id="",
            token_usage=None
        )
        
        result = _compute_agreement(deterministic, llm_verdict)
        assert result == 0.0
    
    def test_agreement_partial_when_rejected_or_revise(self):
        """Test 0.5 agreement for adjacent verdicts."""
        deterministic = DeterministicReport(
            job_id="test",
            checks=[],
            overall_status=OverallStatus.PASS,
            violation_count=0,
            warning_count=0,
            dbwd_rates_used=[]
        )
        llm_verdict = LLMVerdict(
            job_id="test",
            verdict=VerdictStatus.REJECTED,
            reasoning="Too cautious",
            citations=[],
            confidence=0.6,
            rag_context_used=False,
            model="gpt-4o",
            prompt_version="v2",
            langfuse_trace_id="",
            token_usage=None
        )
        
        result = _compute_agreement(deterministic, llm_verdict)
        assert result == 0.5
