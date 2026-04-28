"""End-to-end integration tests — exercises the full stack via the agent API.

These tests require:
  - Backend running on localhost:8000
  - Agent running on localhost:3000

Mark: ``@pytest.mark.e2e`` — skipped automatically when the stack is not running.

Run manually::

    poetry run pytest tests/integration/test_e2e_pipeline.py -m e2e -v
"""

from __future__ import annotations

import httpx
import pytest

AGENT_URL = "http://localhost:3000"
BACKEND_URL = "http://localhost:8000"


def _agent_reachable() -> bool:
    """Check if the agent health endpoint responds."""
    try:
        r = httpx.get(f"{AGENT_URL}/health", timeout=3)
        return r.status_code == 200
    except (httpx.ConnectError, httpx.TimeoutException):
        return False


def _backend_reachable() -> bool:
    """Check if the backend health endpoint responds."""
    try:
        r = httpx.get(f"{BACKEND_URL}/health", timeout=3)
        return r.status_code == 200
    except (httpx.ConnectError, httpx.TimeoutException):
        return False


skip_unless_stack = pytest.mark.skipif(
    not (_agent_reachable() and _backend_reachable()),
    reason="Full stack (agent + backend) not running",
)


@pytest.mark.e2e
@skip_unless_stack
async def test_full_pipeline_text():
    """POST text to agent /api/analyze → receive TrustScoredDecision."""
    payload = {
        "text": (
            "Contractor: E2E Test Corp\n"
            "Project: Federal Building Renovation\n"
            "Location: Washington, DC\n"
            "Certified: 2026-06-01\n"
            "Payroll # 1\n"
            "Week Ending: 2026-06-07\n\n"
            "Name: John Smith\n"
            "Trade: Electrician\n"
            "Hours: 40\n"
            "Hourly Wage: 51.69\n"
            "Fringe: 1385.20\n"
            "Gross: 2067.60\n"
            "Deductions: 150.00\n"
            "Net: 1917.60\n"
        )
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(f"{AGENT_URL}/api/analyze", json=payload)

    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

    body = resp.json()
    assert "job_id" in body, f"Missing job_id in response: {body}"
    assert "trust_score" in body, f"Missing trust_score in response: {body}"
    assert "verdict" in body, f"Missing verdict in response: {body}"

    assert 0.0 <= body["trust_score"] <= 1.0, f"Trust score out of range: {body['trust_score']}"
    assert body["verdict"] in ("approved", "rejected", "requires_review"), (
        f"Unexpected verdict: {body['verdict']}"
    )


@pytest.mark.e2e
@skip_unless_stack
async def test_full_pipeline_pdf():
    """POST a minimal PDF to agent /api/analyze-pdf → receive response."""
    pdf_bytes = b"%PDF-1.4 mock pdf content for e2e test"

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{AGENT_URL}/api/analyze-pdf",
            files={"file": ("test.pdf", pdf_bytes, "application/pdf")},
        )

    assert resp.status_code in (200, 422), (
        f"Expected 200 or 422, got {resp.status_code}: {resp.text}"
    )

    if resp.status_code == 200:
        body = resp.json()
        assert "job_id" in body


@pytest.mark.e2e
@skip_unless_stack
async def test_health_endpoints():
    """Verify both backend and agent health endpoints respond correctly."""
    async with httpx.AsyncClient(timeout=10) as client:
        backend_resp = await client.get(f"{BACKEND_URL}/health")
        agent_resp = await client.get(f"{AGENT_URL}/health")

    assert backend_resp.status_code == 200
    assert agent_resp.status_code == 200

    backend_body = backend_resp.json()
    assert backend_body.get("status") == "ok"

    agent_body = agent_resp.json()
    assert agent_body.get("status") == "ok"
