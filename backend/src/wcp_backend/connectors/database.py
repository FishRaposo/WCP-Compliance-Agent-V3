"""Connectors — Direct database connector (V4 scaffold).

Purpose: Direct database connector for reading from ERP/HR system databases
(read replicas only). Supports PostgreSQL, MySQL, and SQL Server.

Responsibilities:
- Read-only connection to external databases
- Query translation for different SQL dialects
- Connection pooling and timeout handling
- Schema discovery for validation
"""

from __future__ import annotations

from typing import Any

from wcp_backend.connectors.base import BaseConnector, ConnectorConfig

__all__ = ["DatabaseConnector"]


class DatabaseConnector(BaseConnector):
    """Direct database connector (read-only).

    Args:
        config: ConnectorConfig with database connection details.
               connection_config expects: host, port, database,
               username, password, db_type (postgresql|mysql|sqlserver).
    """

    def __init__(self, config: ConnectorConfig) -> None:
        super().__init__(config)
        self._conn: Any | None = None

    def connect(self) -> None:
        self._connected = True

    def disconnect(self) -> None:
        self._connected = False
        self._conn = None

    def fetch(self, **kwargs: Any) -> list[dict]:
        return []

    def validate_config(self) -> list[str]:
        errors: list[str] = []
        cc = self.config.connection_config
        if not cc.get("host"):
            errors.append("Database host is required")
        if not cc.get("database"):
            errors.append("Database name is required")
        return errors
