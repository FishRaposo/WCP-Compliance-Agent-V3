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

__all__ = ["DatabaseConnector"]


class DatabaseConnector:
    """Direct database connector (read-only).

    Args:
        config: ConnectorConfig with database connection details.
               connection_config expects: host, port, database,
               username, password, db_type (postgresql|mysql|sqlserver).
    """

    def __init__(self, config: Any) -> None:
        self.config = config
        self._connected = False
        self._conn: Any | None = None

    def connect(self) -> None:
        """Connect to external database (read replica).

        Raises:
            ConnectorError: On connection failure.
        """
        # Placeholder — implement with asyncpg, mysql-connector, or pyodbc
        self._connected = True

    def disconnect(self) -> None:
        """Close database connection."""
        self._connected = False
        self._conn = None

    def fetch(
        self,
        query: str,
        params: dict[str, Any] | None = None,
        limit: int = 10000,
    ) -> list[dict]:
        """Execute a query and return results.

        Args:
            query: SQL query string.
            params: Query parameters.
            limit: Maximum rows to return.

        Returns:
            List of row dicts.

        Raises:
            ConnectorError: On query failure.
        """
        return []

    def validate_config(self) -> list[str]:
        """Validate database connector configuration.

        Returns:
            List of validation errors.
        """
        return []
