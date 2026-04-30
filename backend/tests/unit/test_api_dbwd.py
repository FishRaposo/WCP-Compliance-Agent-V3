from datetime import date
from unittest.mock import AsyncMock, patch
import pytest
from wcp_backend.models.schemas import DBWDRateRecord

def test_get_dbwd_rate_success(client):
    mock_record = DBWDRateRecord(
        trade="Electrician",
        locality="Washington, DC",
        rate=51.69,
        fringe=34.63,
        effective_date=date(2025, 1, 1),
        wage_determination_number="WD 2025-0001"
    )

    with patch("wcp_backend.api.dbwd.dbwd_lookup.get_dbwd_rate", new_callable=AsyncMock) as mock_service:
        mock_service.return_value = mock_record
        response = client.get("/dbwd/Electrician/Washington,%20DC/2026-01-01")

    assert response.status_code == 200
    data = response.json()
    assert data["trade"] == "Electrician"
    assert data["locality"] == "Washington, DC"
    assert data["rate"] == 51.69
    assert data["fringe"] == 34.63
    assert data["effective_date"] == "2025-01-01"
    assert data["wage_determination_number"] == "WD 2025-0001"

def test_get_dbwd_rate_not_found(client):
    with patch("wcp_backend.api.dbwd.dbwd_lookup.get_dbwd_rate", new_callable=AsyncMock) as mock_service:
        mock_service.side_effect = ValueError("Trade not found")
        response = client.get("/dbwd/NonExistent/DC/2026-01-01")

    assert response.status_code == 404
    assert "Trade not found" in response.json()["detail"]

def test_get_dbwd_rate_server_error(client):
    with patch("wcp_backend.api.dbwd.dbwd_lookup.get_dbwd_rate", new_callable=AsyncMock) as mock_service:
        mock_service.side_effect = Exception("Database connection failed")
        response = client.get("/dbwd/Electrician/DC/2026-01-01")

    assert response.status_code == 500
    assert "DBWD lookup failed" in response.json()["detail"]
    assert "Database connection failed" in response.json()["detail"]
