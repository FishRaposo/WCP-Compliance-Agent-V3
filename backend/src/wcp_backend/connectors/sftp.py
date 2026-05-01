"""Connectors — SFTP connector (V4 scaffold).

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

from typing import Any

__all__ = ["SFTPConnector"]


class SFTPConnector:
    """SFTP connector for CSV/PDF file drops.

    Args:
        config: ConnectorConfig with SFTP connection details.
               connection_config expects: host, port, username,
               password_or_key_path, remote_dir, file_pattern.
    """

    def __init__(self, config: Any) -> None:
        self.config = config
        self._connected = False

    def connect(self) -> None:
        """Connect to SFTP server.

        Raises:
            ConnectorError: On connection failure.
        """
        # Placeholder — implement with asyncssh or pysftp
        self._connected = True

    def disconnect(self) -> None:
        """Disconnect from SFTP server."""
        self._connected = False

    def list_files(self, pattern: str = "*.csv") -> list[str]:
        """List files in the remote directory matching pattern.

        Args:
            pattern: Glob pattern for file filtering.

        Returns:
            List of remote file paths.
        """
        return []

    def download_file(self, remote_path: str, local_path: str) -> str:
        """Download a file from SFTP to local path.

        Args:
            remote_path: Path on SFTP server.
            local_path: Local destination path.

        Returns:
            Local file path.
        """
        return local_path

    def fetch(self, pattern: str = "*.csv", download_dir: str = "/tmp/connectors/sftp") -> list[dict]:
        """Fetch files from SFTP matching pattern.

        Args:
            pattern: File pattern to match.
            download_dir: Local directory to download files to.

        Returns:
            List of dicts with file metadata.
        """
        return []

    def validate_config(self) -> list[str]:
        """Validate SFTP configuration.

        Returns:
            List of validation errors.
        """
        return []
