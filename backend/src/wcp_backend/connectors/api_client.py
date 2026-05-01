"""Connectors — Generic REST API client (V4 scaffold).

Purpose: Generic REST API connector for ERP/HR system integrations.
Handles authentication (API key, OAuth2, Basic), pagination, rate limiting,
and error handling for REST-based data sources.

Responsibilities:
- Multiple auth methods (API key, OAuth2, Basic)
- Automatic pagination (cursor, offset, page-based)
- Rate limiting with exponential backoff
- Error handling with retry logic
"""

from __future__ import annotations

from typing import Any

__all__ = ["APIConnector"]


class APIConnector:
    """Generic REST API connector.

    Args:
        config: ConnectorConfig with API connection details.
               connection_config expects: base_url, auth_type,
               api_key or (client_id, client_secret), headers.
    """

    def __init__(self, config: Any) -> None:
        self.config = config
        self._connected = False
        self._session: Any | None = None

    def connect(self) -> None:
        """Initialize HTTP session and authenticate.

        Raises:
            ConnectorError: On connection/auth failure.
        """
        # Placeholder — implement with httpx or requests
        self._connected = True

    def disconnect(self) -> None:
        """Close HTTP session."""
        self._connected = False
        self._session = None

    def fetch(
        self,
        endpoint: str,
        method: str = "GET",
        params: dict[str, Any] | None = None,
        body: dict[str, Any] | None = None,
    ) -> list[dict]:
        """Fetch data from API endpoint.

        Args:
            endpoint: API endpoint path (appended to base_url).
            method: HTTP method (GET, POST, etc.).
            params: Query parameters.
            body: Request body (for POST/PUT).

        Returns:
            List of record dicts.

        Raises:
            ConnectorError: On API error.
        """
        return []

    def validate_config(self) -> list[str]:
        """Validate API connector configuration.

        Returns:
            List of validation errors.
        """
        return []
