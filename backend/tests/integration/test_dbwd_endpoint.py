"""Integration tests for GET /dbwd/{trade}/{locality}/{date} endpoint."""


class TestDbwdEndpoint:
    """Test suite for the DBWD rate lookup API endpoint."""

    def test_dbwd_known_trade(self, client):
        """GET /dbwd/Electrician/Washington, DC/2026-01-01 returns rate."""
        response = client.get("/dbwd/Electrician/Washington, DC/2026-01-01")

        assert response.status_code == 200
        body = response.json()

        assert body["trade"] == "Electrician"
        assert body["locality"] == "Washington, DC"
        assert body["rate"] == 51.69
        assert body["fringe"] == 34.63
        assert "effective_date" in body

    def test_dbwd_trade_alias(self, client):
        """GET /dbwd/ELEC/... resolves to Electrician via alias."""
        response = client.get("/dbwd/ELEC/Washington, DC/2026-01-01")

        assert response.status_code == 200
        body = response.json()

        assert body["trade"] == "Electrician"
        assert body["rate"] == 51.69

    def test_dbwd_fuzzy_match(self, client):
        """GET /dbwd/Electrian/... (misspelled) fuzzy matches to Electrician."""
        response = client.get("/dbwd/Electrian/Washington, DC/2026-01-01")

        assert response.status_code == 200
        body = response.json()

        assert body["trade"] == "Electrician"

    def test_dbwd_another_trade(self, client):
        """GET /dbwd/Plumber returns correct plumber rate."""
        response = client.get("/dbwd/Plumber/Washington, DC/2026-01-01")

        assert response.status_code == 200
        body = response.json()

        assert body["trade"] == "Plumber"
        assert body["rate"] == 48.50
        assert body["fringe"] == 32.25

    def test_dbwd_unknown_trade(self, client):
        """GET /dbwd/UnknownTrade/... returns 404."""
        response = client.get("/dbwd/UnknownTrade123/Washington, DC/2026-01-01")

        assert response.status_code == 404
        body = response.json()
        assert "detail" in body
        assert "not found" in body["detail"].lower() or "Trade" in body["detail"]

    def test_dbwd_different_locality_not_found(self, client):
        """GET /dbwd/Electrician/Unknown City/... returns 404 (no rates for that locality)."""
        response = client.get("/dbwd/Electrician/Unknown City, XX/2026-01-01")

        # Should return 404 because no rates exist for that locality
        assert response.status_code == 404
