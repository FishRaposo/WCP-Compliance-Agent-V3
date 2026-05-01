"""Connectors — Base connector abstract class (V4 scaffold).

Purpose: Abstract base class for all enterprise system connectors.
Provides a consistent interface for connect(), fetch(), validate(), and sync().

Responsibilities:
- Abstract base class for all connectors
- Connection configuration storage and validation
- Scheduled sync via Prefect (pull from external sources)
- Error handling and retry logic per connector type

Key files (V4 spec):
- connectors/base.py    — BaseConnector ABC with connect(), fetch(), validate()
- connectors/sftp.py   — SFTP connector for CSV/PDF drops
- connectors/api_client.py — Generic REST API connector
- connectors/database.py — Direct database connector (read replicas)
- connectors/registry.py — Connector discovery and configuration
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

__all__ = ["BaseConnector", "ConnectorConfig", "ConnectorError"]


class ConnectorError(Exception):
    """Base exception for connector errors."""

    pass


class ConnectorConfig:
    """Configuration for a connector instance."""

    def __init__(
        self,
        name: str,
        connector_type: str,
        connection_config: dict[str, Any],
        schedule_cron: str | None = None,
        is_active: bool = True,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        self.name = name
        self.connector_type = connector_type
        self.connection_config = connection_config
        self.schedule_cron = schedule_cron
        self.is_active = is_active
        self.metadata = metadata or {}

    def validate(self) -> list[str]:
        """Validate connector configuration.

        Returns:
            List of validation error messages (empty if valid).
        """
        return []


class BaseConnector(ABC):
    """Abstract base class for all enterprise connectors.

    Subclasses must implement:
    - connect(): Establish connection to the external system
    - fetch(): Pull data from the external system
    - validate_config(): Validate connection configuration
    - disconnect(): Clean up connection resources

    Example:
        class SFTPConnector(BaseConnector):
            def connect(self) -> None:
                ...

            def fetch(self, path: str) -> list[dict]:
                ...
    """

    def __init__(self, config: ConnectorConfig) -> None:
        self.config = config
        self._connected = False

    @abstractmethod
    def connect(self) -> None:
        """Establish connection to the external system.

        Raises:
            ConnectorError: On connection failure.
        """
        ...

    @abstractmethod
    def disconnect(self) -> None:
        """Disconnect and clean up resources."""
        ...

    @abstractmethod
    def fetch(self, **kwargs: Any) -> list[dict]:
        """Fetch data from the external system.

        Args:
            **kwargs: Connector-specific fetch parameters.

        Returns:
            List of record dicts.

        Raises:
            ConnectorError: On fetch failure.
        """
        ...

    @abstractmethod
    def validate_config(self) -> list[str]:
        """Validate the connector configuration.

        Returns:
            List of validation error messages (empty if valid).
        """
        ...

    def is_connected(self) -> bool:
        """Check if connector is currently connected.

        Returns:
            True if connected, False otherwise.
        """
        return self._connected

    async def async_fetch(self, **kwargs: Any) -> list[dict]:
        """Async wrapper for fetch.

        Default implementation runs fetch in a thread pool.
        Override for truly async connectors.
        """
        import asyncio

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, lambda: self.fetch(**kwargs))
