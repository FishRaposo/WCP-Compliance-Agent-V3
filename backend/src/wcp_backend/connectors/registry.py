"""Connectors — Connector registry (V4 scaffold).

Purpose: Registry for discovering and managing connector instances.
Provides a singleton registry that tracks all configured connectors,
handles lifecycle (connect/disconnect/sync), and supports cron-based scheduling.

Responsibilities:
- Register connector instances by name and type
- Lifecycle management (connect, disconnect, sync)
- Cron-based scheduling for periodic syncs
- Connector health checking
"""

from __future__ import annotations

from typing import Any

__all__ = ["ConnectorRegistry", "get_registry"]


class ConnectorRegistry:
    """Registry for all connector instances.

    Manages connector lifecycle and discovery.
    """

    def __init__(self) -> None:
        self._connectors: dict[str, Any] = {}
        self._registry: list[dict[str, Any]] = []

    def register(self, connector_config: dict[str, Any]) -> None:
        """Register a connector configuration.

        Args:
            connector_config: Dict with name, type, connection_config, schedule_cron, is_active.
        """
        name = connector_config.get("name")
        self._registry.append(connector_config)
        self._connectors[name] = connector_config

    def get(self, name: str) -> dict[str, Any] | None:
        """Get connector configuration by name.

        Args:
            name: Connector name.

        Returns:
            Connector config dict or None if not found.
        """
        return self._connectors.get(name)

    def list_connectors(self, connector_type: str | None = None) -> list[dict[str, Any]]:
        """List all registered connectors.

        Args:
            connector_type: Filter by type (sftp, api, database).

        Returns:
            List of connector config dicts.
        """
        if connector_type is None:
            return list(self._connectors.values())
        return [c for c in self._connectors.values() if c.get("type") == connector_type]

    def list_active(self) -> list[dict[str, Any]]:
        """List all active connectors.

        Returns:
            List of active connector config dicts.
        """
        return [c for c in self._connectors.values() if c.get("is_active", False)]

    def unregister(self, name: str) -> None:
        """Unregister a connector by name.

        Args:
            name: Connector name.
        """
        self._connectors.pop(name, None)
        self._registry = [r for r in self._registry if r.get("name") != name]


# Singleton registry instance
_registry: ConnectorRegistry | None = None


def get_registry() -> ConnectorRegistry:
    """Get or create the global connector registry.

    Returns:
        ConnectorRegistry singleton.
    """
    global _registry
    if _registry is None:
        _registry = ConnectorRegistry()
    return _registry
