"""Integration tests for GET /health endpoint."""

import re

from wcp_backend.config import settings


class TestHealthEndpoint:
    """Test suite for the health check API endpoint."""

    def test_health_returns_ok(self, client):
        """GET /health returns 200 with status: ok."""
        response = client.get("/health")

        assert response.status_code == 200
        body = response.json()

        assert body["status"] == "ok"
        assert "version" in body
        assert "phase" in body

    def test_health_version_format(self, client):
        """Version matches semantic format (3.x.x)."""
        response = client.get("/health")
        body = response.json()

        version = body["version"]
        # Match semantic version format: major.minor.patch
        assert re.match(r"^3\.\d+\.\d+$", version), f"Version {version} doesn't match expected format 3.x.x"

    def test_health_phase_indicator(self, client):
        """Health endpoint indicates current phase."""
        response = client.get("/health")
        body = response.json()

        assert body["phase"] == settings.phase

    def test_health_response_structure(self, client):
        """Health response has all expected fields."""
        response = client.get("/health")
        body = response.json()

        expected_fields = {"status", "version", "phase"}
        actual_fields = set(body.keys())

        assert expected_fields <= actual_fields, f"Missing fields: {expected_fields - actual_fields}"

        if settings.phase >= 2:
            assert "services" in body
            assert {"database", "redis", "elasticsearch", "phoenix"} <= set(body["services"])
