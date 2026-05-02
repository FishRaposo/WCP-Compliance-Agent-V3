"""Connectors -- SFTP connector (V4).

Purpose: SFTP connector for reading CSV/PDF files dropped into SFTP directories.
Used for automated payroll file ingestion from contractors.

Responsibilities:
- Connect to SFTP server with key-based or password auth
- List directory contents (filtered by extension)
- Download files to local staging area
- Track last-sync timestamp per file
- Handle partial/broken files gracefully
"""

from __future__ import annotations

import fnmatch
import logging
import os
from pathlib import Path
from typing import Any

from wcp_backend.connectors.base import BaseConnector, ConnectorConfig, ConnectorError

__all__ = ["SFTPConnector"]

logger = logging.getLogger(__name__)

try:
    import paramiko

    _paramiko_available = True
except ImportError:
    paramiko = None  # type: ignore[assignment]
    _paramiko_available = False


class SFTPConnector(BaseConnector):
    """SFTP connector for CSV/PDF file drops.

    Args:
        config: ConnectorConfig with SFTP connection details.
               connection_config expects: host, port, username,
               password, key_path, remote_dir, file_pattern.
    """

    def __init__(self, config: ConnectorConfig) -> None:
        super().__init__(config)
        self._ssh_client: Any = None
        self._sftp_client: Any = None

    def connect(self) -> None:
        if not _paramiko_available:
            raise ConnectorError("paramiko not installed")
        cc = self.config.connection_config
        host = cc.get("host", "")
        port = int(cc.get("port", 22))
        username = cc.get("username", "")
        password = cc.get("password")
        key_path = cc.get("key_path")

        self._ssh_client = paramiko.SSHClient()
        self._ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        connect_kwargs: dict[str, Any] = {
            "hostname": host,
            "port": port,
            "username": username,
        }
        if key_path:
            connect_kwargs["key_filename"] = key_path
        if password and not key_path:
            connect_kwargs["password"] = password

        try:
            self._ssh_client.connect(**connect_kwargs)
            transport = self._ssh_client.get_transport()
            if transport is None:
                raise ConnectorError("Failed to get SSH transport")
            self._sftp_client = transport.open_sftp_client()
            self._connected = True
            logger.info("Connected to SFTP %s:%d as %s", host, port, username)
        except ConnectorError:
            raise
        except Exception as exc:
            self._ssh_client = None
            self._sftp_client = None
            raise ConnectorError(f"SFTP connection failed: {exc}") from exc

    def disconnect(self) -> None:
        if self._sftp_client is not None:
            try:
                self._sftp_client.close()
            except Exception as exc:
                logger.warning("Error closing SFTP client: %s", exc)
            self._sftp_client = None
        if self._ssh_client is not None:
            try:
                self._ssh_client.close()
            except Exception as exc:
                logger.warning("Error closing SSH client: %s", exc)
            self._ssh_client = None
        self._connected = False
        logger.debug("Disconnected from SFTP")

    def list_files(self, pattern: str | None = None) -> list[str]:
        if self._sftp_client is None:
            raise ConnectorError("Not connected to SFTP")
        cc = self.config.connection_config
        remote_dir = cc.get("remote_dir", ".")
        file_pattern = pattern or cc.get("file_pattern", "*.csv")
        try:
            entries = self._sftp_client.listdir(remote_dir)
        except Exception as exc:
            raise ConnectorError(f"Failed to list remote directory {remote_dir}: {exc}") from exc
        matched = sorted(fnmatch.filter(entries, file_pattern))
        logger.debug("Listed %d files matching '%s' in %s", len(matched), file_pattern, remote_dir)
        return matched

    def download_file(self, remote_path: str, local_path: str) -> str:
        if self._sftp_client is None:
            raise ConnectorError("Not connected to SFTP")
        try:
            local_dir = os.path.dirname(local_path)
            if local_dir:
                Path(local_dir).mkdir(parents=True, exist_ok=True)
            self._sftp_client.get(remote_path, local_path)
            logger.info("Downloaded %s -> %s", remote_path, local_path)
            return local_path
        except Exception as exc:
            raise ConnectorError(f"Failed to download {remote_path}: {exc}") from exc

    def fetch(self, pattern: str | None = None, download_dir: str | None = None, **kwargs: Any) -> list[dict]:
        if self._sftp_client is None:
            raise ConnectorError("Not connected to SFTP")
        cc = self.config.connection_config
        remote_dir = cc.get("remote_dir", ".")
        file_pattern = pattern or cc.get("file_pattern", "*.csv")
        dest_dir = download_dir or "."

        Path(dest_dir).mkdir(parents=True, exist_ok=True)
        filenames = self.list_files(file_pattern)
        results: list[dict[str, Any]] = []

        for filename in filenames:
            remote_path = f"{remote_dir}/{filename}" if remote_dir != "." else filename
            local_path = os.path.join(dest_dir, filename)
            try:
                self.download_file(remote_path, local_path)
                stat = self._sftp_client.stat(remote_path)
                results.append({
                    "remote_path": remote_path,
                    "local_path": local_path,
                    "size": stat.st_size if stat else 0,
                    "filename": filename,
                })
            except Exception as exc:
                logger.error("Failed to fetch %s: %s", remote_path, exc)

        logger.info("Fetched %d/%d files from %s", len(results), len(filenames), remote_dir)
        return results

    def validate_config(self) -> list[str]:
        errors: list[str] = []
        cc = self.config.connection_config
        if not cc.get("host"):
            errors.append("SFTP host is required")
        if not cc.get("username"):
            errors.append("SFTP username is required")
        if not cc.get("password") and not cc.get("key_path"):
            errors.append("SFTP password or key_path is required")
        return errors
