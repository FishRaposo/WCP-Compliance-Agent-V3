import pytest
from wcp_backend.models.graph import (
    ComplianceGraph,
    WCPNode,
    EmployeeNode,
    CheckNode,
    VerdictNode,
    TrustScoreNode,
)

def test_compliance_graph_to_dict():
    wcp = WCPNode(
        job_id="job_123",
        contractor_name="Acme Corp",
        project_name="Build-a-Bear",
        week_ending="2023-10-27"
    )
    employees = [
        EmployeeNode(name="John Doe", trade="Electrician", job_id="job_123")
    ]
    checks = [
        CheckNode(check_id="check_1", check_type="wage", status="pass", employee_name="John Doe")
    ]
    verdict = VerdictNode(job_id="job_123", verdict="pass", confidence=0.95)
    trust_score = TrustScoreNode(job_id="job_123", score=0.9, band="high", requires_review=False)

    graph = ComplianceGraph(
        wcp=wcp,
        employees=employees,
        checks=checks,
        verdict=verdict,
        trust_score=trust_score
    )

    result = graph.to_dict()

    assert result["wcp"]["job_id"] == "job_123"
    assert result["employees"][0]["name"] == "John Doe"
    assert result["checks"][0]["check_id"] == "check_1"
    assert result["verdict"]["verdict"] == "pass"
    assert result["trust_score"]["score"] == 0.9
