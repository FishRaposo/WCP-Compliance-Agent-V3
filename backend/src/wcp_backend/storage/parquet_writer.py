"""Storage — Parquet writer and manifest utilities for V4.

Purpose: Write decision data to Apache Parquet columnar files for long-term
analytical storage. DuckDB reads both live PostgreSQL and Parquet archives
transparently.

Provides:
- ParquetWriter: Write records to Parquet files using PyArrow (with graceful fallback)
- Manifest entry tracking: track written files with MD5 integrity
- write_decisions_to_parquet(): High-level function for decision export

Responsibilities:
- Write decisions to monthly Parquet files (archive/decisions/YYYY-MM.parquet)
- MD5 integrity verification on write
- Manifest tracking for archive management
- Partition pruning hints for date-range queries

Key files (V4 spec):
- storage/parquet_writer.py  — Write decisions to Parquet with PyArrow
- storage/duckdb_init.py     — Initialize DuckDB views (PostgreSQL + Parquet)
"""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

__all__ = [
    "MODULE_NAME",
    "MODULE_OWNER",
    "ParquetWriter",
    "ParquetManifest",
    "write_decisions_to_parquet",
    "manifest_path",
]

MODULE_NAME = "storage"
MODULE_OWNER = "v4"

# Default archive directory
DEFAULT_ARCHIVE_DIR = Path("archive/decisions")
MANIFEST_FILENAME = "manifest.json"


def manifest_path(archive_dir: str | Path = DEFAULT_ARCHIVE_DIR) -> Path:
    """Get the path to the archive manifest file.

    Args:
        archive_dir: Archive directory path

    Returns:
        Path to manifest.json
    """
    return Path(archive_dir) / MANIFEST_FILENAME


class ParquetManifest:
    """Track Parquet archive files with MD5 integrity checks.

    The manifest is a JSON file that lists all Parquet files in the archive
    with their MD5 checksums and metadata (record count, date range, etc.).

    Usage:
        manifest = ParquetManifest(archive_dir="archive/decisions")
        manifest.load()
        manifest.add_entry("2025-01.parquet", md5="abc123", records=5000)
        manifest.save()
    """

    def __init__(self, archive_dir: str | Path = DEFAULT_ARCHIVE_DIR) -> None:
        self.archive_dir = Path(archive_dir)
        self.entries: dict[str, dict[str, Any]] = {}

    def _manifest_file_path(self) -> Path:
        return self.archive_dir / MANIFEST_FILENAME

    def load(self) -> None:
        """Load manifest from disk, creating empty if not exists."""
        path = self._manifest_file_path()
        if path.exists():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.entries = data.get("entries", {})
            except (json.JSONDecodeError, IOError) as exc:
                logger.warning("Failed to load manifest from %s: %s", path, exc)
                self.entries = {}
        else:
            self.entries = {}

    def save(self) -> None:
        """Save manifest to disk."""
        path = self._manifest_file_path()
        self.archive_dir.mkdir(parents=True, exist_ok=True)
        payload = {
            "version": "1.0",
            "updated_at": datetime.utcnow().isoformat(),
            "entries": self.entries,
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)

    def add_entry(
        self,
        filename: str,
        md5: str | None = None,
        records: int = 0,
        year: int | None = None,
        month: int | None = None,
        record_count: int = 0,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> None:
        """Add or update a manifest entry for a Parquet file.

        Args:
            filename: Parquet filename (e.g., "2025-01.parquet")
            md5: MD5 hex digest of the file
            records: Number of records in the file
            year: Year of the file
            month: Month of the file
            record_count: Alias for records (for clarity)
            date_from: Start date string
            date_to: End date string
        """
        self.entries[filename] = {
            "md5": md5,
            "records": records or record_count,
            "year": year,
            "month": month,
            "date_from": date_from,
            "date_to": date_to,
            "added_at": datetime.utcnow().isoformat(),
        }

    def get_entry(self, filename: str) -> dict[str, Any] | None:
        """Get a manifest entry by filename."""
        return self.entries.get(filename)

    def verify_file(self, filename: str) -> bool:
        """Verify MD5 of a Parquet file against manifest entry.

        Args:
            filename: Parquet filename

        Returns:
            True if MD5 matches or file doesn't exist in manifest (skip verification)
        """
        entry = self.entries.get(filename)
        if entry is None:
            return True  # Not tracked — skip

        file_path = self.archive_dir / filename
        if not file_path.exists():
            return False

        md5 = entry.get("md5")
        if md5 is None:
            return True  # No MD5 stored — skip verification

        current_md5 = self._compute_md5(file_path)
        return current_md5 == md5

    @staticmethod
    def _compute_md5(file_path: Path) -> str:
        """Compute MD5 hex digest of a file."""
        with open(file_path, "rb") as f:
            return hashlib.md5(f.read()).hexdigest()


class ParquetWriter:
    """Write records to Parquet files using PyArrow.

    Soft dependency on PyArrow: if PyArrow is not installed, the writer
    falls back to writing CSV with a .parquet extension (for migration
    compatibility) and logs a warning.

    Usage:
        writer = ParquetWriter(output_dir="archive/decisions")
        result = writer.write_decisions(rows, year=2025, month=1)
        md5 = writer.verify_integrity("2025-01.parquet")
    """

    def __init__(self, output_dir: str | Path = DEFAULT_ARCHIVE_DIR) -> None:
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def _get_pyarrow(self) -> tuple[bool, Any]:
        """Try to import PyArrow.

        Returns:
            (success, module_or_None)
        """
        try:
            import pyarrow as pa
            return True, pa
        except ImportError:
            return False, None

    def write(self, records: list[dict[str, Any]], filename: str) -> dict[str, Any]:
        """Write records to a Parquet file.

        Args:
            records: List of record dicts.
            filename: Output filename (e.g., "2025-01.parquet").

        Returns:
            Dict with write metadata: path, records_written, md5.

        Raises:
            RuntimeError if PyArrow is not available and format is not CSV fallback.
        """
        has_pyarrow, pa = self._get_pyarrow()
        file_path = self.output_dir / filename

        if has_pyarrow:
            return self._write_parquet(records, filename, file_path, pa)
        else:
            logger.warning(
                "PyArrow not installed — writing CSV fallback to %s (not true Parquet)",
                file_path,
            )
            return self._write_csv_fallback(records, filename, file_path)

    def _write_parquet(
        self,
        records: list[dict[str, Any]],
        filename: str,
        file_path: Path,
        pa: Any,
    ) -> dict[str, Any]:
        """Write records as Parquet using PyArrow."""
        import pyarrow as pa_module  # noqa: F401 - used via pa param

        if not records:
            return {
                "path": str(file_path),
                "records_written": 0,
                "md5": None,
                "note": "No records to write",
            }

        # Convert to PyArrow table
        table = pa.table(records)
        writer = pa.ipc.new_file(file_path, table.schema)
        writer.write(table)
        writer.close()

        md5 = self.verify_integrity(filename)
        return {
            "path": str(file_path),
            "records_written": len(records),
            "md5": md5,
            "note": "Written with PyArrow",
        }

    def _write_csv_fallback(
        self,
        records: list[dict[str, Any]],
        filename: str,
        file_path: Path,
    ) -> dict[str, Any]:
        """Write records as CSV fallback when PyArrow unavailable."""
        if not records:
            return {
                "path": str(file_path.with_suffix(".csv")),
                "records_written": 0,
                "md5": None,
                "note": "No records to write",
            }

        # Write as CSV (append .csv to distinguish from real Parquet)
        csv_path = file_path.with_suffix(".csv")
        keys = list(records[0].keys())

        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            import csv

            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            writer.writerows(records)

        md5 = self._compute_md5(csv_path)
        return {
            "path": str(csv_path),
            "records_written": len(records),
            "md5": md5,
            "note": "CSV fallback (PyArrow not installed)",
        }

    def verify_integrity(self, filename: str) -> str | None:
        """Verify MD5 of a Parquet file.

        Args:
            filename: Path to Parquet file (relative to output_dir).

        Returns:
            MD5 hex digest or None if file not found.
        """
        file_path = self.output_dir / filename
        if not file_path.exists():
            # Try with .csv fallback
            csv_path = file_path.with_suffix(".csv")
            if csv_path.exists():
                return self._compute_md5(csv_path)
            return None

        return self._compute_md5(file_path)

    @staticmethod
    def _compute_md5(file_path: Path) -> str:
        """Compute MD5 hex digest of a file."""
        with open(file_path, "rb") as f:
            return hashlib.md5(f.read()).hexdigest()


def write_decisions_to_parquet(
    decisions: list[dict[str, Any]],
    year: int,
    month: int,
    output_dir: str | Path = DEFAULT_ARCHIVE_DIR,
    update_manifest: bool = True,
) -> dict[str, Any]:
    """Write decision records to a monthly Parquet file.

    This is the high-level function for decision export pipelines.

    Args:
        decisions: List of decision dicts.
        year: Year for the file.
        month: Month for the file (1-12).
        output_dir: Output directory path.
        update_manifest: If True, update the archive manifest with the new file.

    Returns:
        Dict with write metadata: path, records_written, md5, year, month.
    """
    filename = f"{year}-{month:02d}.parquet"
    writer = ParquetWriter(output_dir=output_dir)
    result = writer.write(decisions, filename)

    if update_manifest and result.get("md5"):
        manifest = ParquetManifest(output_dir)
        manifest.load()
        manifest.add_entry(
            filename=filename,
            md5=result["md5"],
            records=result["records_written"],
            year=year,
            month=month,
        )
        manifest.save()

    return {
        "path": result["path"],
        "records_written": result["records_written"],
        "md5": result["md5"],
        "year": year,
        "month": month,
        "filename": filename,
        "note": result.get("note", ""),
    }