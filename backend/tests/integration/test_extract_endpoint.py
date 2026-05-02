"""Integration tests for POST /extract endpoint."""

from unittest.mock import patch


class TestExtractEndpoint:
    """Test suite for the extraction API endpoint."""

    def test_extract_text_success(self, client, sample_wh347_text):
        """POST /extract with valid text returns ExtractedWCP."""
        response = client.post("/extract", json=sample_wh347_text)

        assert response.status_code == 200
        body = response.json()

        # Verify structure
        assert "job_id" in body
        assert body["contractor"]["name"] == "ABC Construction"
        assert body["project"]["location"] == "Washington, DC"
        assert len(body["employees"]) == 1

        # Verify employee data
        emp = body["employees"][0]
        assert emp["name"] == "John Smith"
        assert emp["trade_classification"] == "Electrician"
        assert emp["hours_worked"] == 40.0
        assert emp["hourly_wage"] == 51.69

    def test_extract_pdf_success(self, client, mock_pdf_bytes):
        """POST /extract with multipart PDF returns ExtractedWCP."""
        # Mock extract_from_pdf to return predictable data
        mock_result = {
            "job_id": "pdf-test-123",
            "contractor": {"name": "PDF Contractor", "address": "", "ein": ""},
            "project": {"name": "PDF Project", "location": "DC", "contract_number": "", "wage_determination_number": ""},
            "employees": [],
            "certification_date": None,
            "payroll_number": None,
            "week_ending": None,
        }

        with patch("wcp_backend.api.extract.extract_from_pdf", return_value=mock_result):
            response = client.post(
                "/extract",
                files={"file": ("sample.pdf", mock_pdf_bytes, "application/pdf")},
            )

        assert response.status_code == 200
        body = response.json()
        assert body["job_id"] == "pdf-test-123"
        assert body["contractor"]["name"] == "PDF Contractor"

    def test_extract_missing_body(self, client):
        """POST /extract with no body returns 400."""
        response = client.post("/extract")

        assert response.status_code == 400
        assert response.json()["detail"] == "Provide 'text' or 'file'"

    def test_extract_invalid_pdf(self, client):
        """POST /extract with corrupted PDF returns empty structure with job_id.

        NOTE: The endpoint returns 200 with an empty/minimal structure for
        corrupted or unreadable PDFs rather than raising a 4xx/5xx error.
        This is intentional so that downstream processing can continue with
        a placeholder job_id and manual review flags.
        """
        # Send invalid PDF bytes (not matching expected format)
        invalid_pdf = b"This is not a PDF"

        response = client.post(
            "/extract",
            files={"file": ("corrupt.pdf", invalid_pdf, "application/pdf")},
        )

        # Should return 200 with empty/minimal structure
        assert response.status_code == 200
        body = response.json()
        assert "job_id" in body
        assert body["contractor"]["name"] == "Unknown"

    def test_extract_trade_alias_resolution(self, client):
        """POST /extract resolves trade aliases (ELEC -> Electrician)."""
        text = """
        Name: Test Worker
        Trade: ELEC
        Hours: 40
        Wage: 51.69
        Fringe: 1385.20
        Gross: 2067.60
        Deductions: 150.00
        Net: 1917.60
        """

        response = client.post("/extract", json=text)

        assert response.status_code == 200
        emp = response.json()["employees"][0]
        assert emp["trade_classification"] == "Electrician"
