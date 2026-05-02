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

from wcp_backend.connectors.base import BaseConnector, ConnectorConfig

__all__ = ["APIConnector"]


class APIConnector(BaseConnector):
    """Generic REST API connector.

    Args:
        config: ConnectorConfig with API connection details.
               connection_config expects: base_url, auth_type,
               api_key or (client_id, client_secret), headers.
    """

    def __init__(self, config: ConnectorConfig) -> None:
        super().__init__(config)
        self._session: Any | None = None

    def connect(self) -> None:
        self._connected = True

    def disconnect(self) -> None:
        self._connected = False
        self._session = None

    def fetch(self, **kwargs: Any) -> list[dict]:
        return []

    def validate_config(self) -> list[str]:
        errors: list[str] = []
        cc = self.config.connection_config
        if not cc.get("base_url"):
            errors.append("API base_url is required")
        return errors
