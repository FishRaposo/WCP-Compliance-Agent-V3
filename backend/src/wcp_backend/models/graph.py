"""
Entity relationship model for the WCP compliance graph.
Currently uses in-memory representation (NetworkX-compatible).
Designed for future migration to Neo4j.

Graph shape:
  WCP → Employee → Check → Verdict → TrustScore
"""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class WCPNode:
    job_id: str
    contractor_name: str
    project_name: str
    week_ending: str


@dataclass
class EmployeeNode:
    name: str
    trade: str
    job_id: str


@dataclass
class CheckNode:
    check_id: str
    check_type: str
    status: str
    employee_name: str


@dataclass
class VerdictNode:
    job_id: str
    verdict: str
    confidence: float


@dataclass
class TrustScoreNode:
    job_id: str
    score: float
    band: str
    requires_review: bool


@dataclass
class ComplianceGraph:
    """In-memory compliance graph for a single WCP submission."""

    wcp: WCPNode
    employees: list[EmployeeNode] = field(default_factory=list)
    checks: list[CheckNode] = field(default_factory=list)
    verdict: VerdictNode | None = None
    trust_score: TrustScoreNode | None = None

    def to_dict(self) -> dict[str, Any]:
        """Serialize the compliance graph to a dict suitable for Phoenix/audit traces."""
        result: dict[str, Any] = {
            "wcp": {
                "job_id": self.wcp.job_id,
                "contractor_name": self.wcp.contractor_name,
                "project_name": self.wcp.project_name,
                "week_ending": self.wcp.week_ending,
            },
            "employees": [
                {"name": e.name, "trade": e.trade, "job_id": e.job_id}
                for e in self.employees
            ],
            "checks": [
                {
                    "check_id": c.check_id,
                    "check_type": c.check_type,
                    "status": c.status,
                    "employee_name": c.employee_name,
                }
                for c in self.checks
            ],
        }

        if self.verdict is not None:
            result["verdict"] = {
                "job_id": self.verdict.job_id,
                "verdict": self.verdict.verdict,
                "confidence": self.verdict.confidence,
            }

        if self.trust_score is not None:
            result["trust_score"] = {
                "job_id": self.trust_score.job_id,
                "score": self.trust_score.score,
                "band": self.trust_score.band,
                "requires_review": self.trust_score.requires_review,
            }

        return result
