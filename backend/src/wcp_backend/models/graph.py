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
        # TODO: implement serialization for Phoenix/audit trace
        raise NotImplementedError
