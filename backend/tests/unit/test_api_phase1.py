"""Unit tests for Phase 1 API contracts."""

from unittest.mock import patch

from wcp_backend.models.schemas import ContractorInfo, ExtractedWCP, ProjectInfo


def _empty_extracted(job_id: str = "api-test") -> ExtractedWCP:
    return ExtractedWCP(
        job_id=job_id,
        contractor=ContractorInfo(name="Test Contractor"),
        project=ProjectInfo(name="Test Project", location="Washington, DC"),
        employees=[],
        certification_date="2026-01-15",
    )


def test_health_returns_phase_1_version(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": "3.0.2", "phase": 1}


def test_extract_accepts_text_body(client):
    text = """
    Name: John Smith
    Trade: Electrician
    Hours: 40
    Wage: 51.69
    Fringe: 34.63
    Gross: 2067.60
    Deductions: 150.00
    Net: 1917.60
    """

    response = client.post("/extract", json=text)

    assert response.status_code == 200
    body = response.json()
    assert body["employees"][0]["name"] == "John Smith"
    assert body["employees"][0]["trade_classification"] == "Electrician"


def test_extract_accepts_file_on_same_route(client):
    with patch("wcp_backend.api.extract.extract_from_pdf", return_value=_empty_extracted("pdf-test")):
        response = client.post(
            "/extract",
            files={"file": ("sample.pdf", b"%PDF mocked", "application/pdf")},
        )

    assert response.status_code == 200
    assert response.json()["job_id"] == "pdf-test"


def test_extract_requires_text_or_file(client):
    response = client.post("/extract")

    assert response.status_code == 400
    assert response.json()["detail"] == "Provide 'text' or 'file'"
