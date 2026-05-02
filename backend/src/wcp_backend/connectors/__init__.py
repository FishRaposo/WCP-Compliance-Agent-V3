"""Connectors — Enterprise system integrations for V4 data platform.

Provides connectors for:
- SFTP (CSV/PDF file drops)
- REST APIs (ERP/HR systems like Procore)
- SAM.gov (Davis-Bacon wage determinations)
- Direct database (read replicas)
"""

from __future__ import annotations

from wcp_backend.connectors.base import (
    BaseConnector,
    ConnectorConfig,
    ConnectorError,
)
from wcp_backend.connectors.sftp import SFTPConnector
from wcp_backend.connectors.api_client import APIConnector
from wcp_backend.connectors.sam_gov import (
    SamGovClient,
    SamGovError,
    create_sam_gov_connector_config,
)

__all__ = [
    "MODULE_NAME",
    "MODULE_OWNER",
    "BaseConnector",
    "ConnectorConfig",
    "ConnectorError",
    "SFTPConnector",
    "APIConnector",
    "SamGovClient",
    "SamGovError",
    "create_sam_gov_connector_config",
]

MODULE_NAME = "connectors"
MODULE_OWNER = "v4"
