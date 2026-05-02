"""Quality — Checkpoint runner with artifact persistence (V4).

Purpose: Run GE validation checkpoints and persist results as artifacts
for audit trails and quarantine management.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

from wcp_backend.quality.ge_runtime import GERuntime

_logger = logging.getLogger(__name__)

__all__ = ["CheckpointRunner", "ValidationArtifact"]


class ValidationArtifact:
    """Represents a persisted validation result artifact."""

    def __init__(
        self,
        artifact_id: str,
        suite_name: str,
        success: bool,
        result: dict[str, Any],
        timestamp: str | None = None,
        artifact_path: str | None = None,
    ) -> None:
        self.artifact_id = artifact_id
        self.suite_name = suite_name
        self.success = success
        self.result = result
        self.timestamp = timestamp or datetime.now(timezone.utc).isoformat()
        self.artifact_path = artifact_path

    def to_dict(self) -> dict[str, Any]:
        return {
            "artifact_id": self.artifact_id,
            "suite_name": self.suite_name,
            "success": self.success,
            "timestamp": self.timestamp,
            "result": self.result,
            "artifact_path": self.artifact_path,
        }


class CheckpointRunner:
    """Runs validation checkpoints and persists artifacts.

    Integrates with Prefect flows to run validation as part of data pipelines.
    """

    def __init__(
        self,
        artifact_store_path: str | None = None,
        context_root_dir: str | None = None,
    ) -> None:
        self.runtime = GERuntime(context_root_dir=context_root_dir)
        self.artifact_store_path = artifact_store_path or os.environ.get(
            "GE_ARTIFACT_STORE", "./validation_artifacts"
        )
        os.makedirs(self.artifact_store_path, exist_ok=True)

    def run_checkpoint(
        self,
        suite_name: str,
        data: list[dict[str, Any]],
        expectation_suite: list[dict[str, Any]],
        job_id: str | None = None,
    ) -> ValidationArtifact:
        """Run a validation checkpoint and persist the artifact.

        Args:
            suite_name: Name of the expectation suite.
            data: Data to validate.
            expectation_suite: List of expectation definitions.
            job_id: Optional ingestion job ID for correlation.

        Returns:
            ValidationArtifact with result and persistence info.
        """
        artifact_id = job_id or f"{suite_name}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{id(data) % 10000}"

        # Run validation
        result = self.runtime.run_checkpoint(suite_name, data, expectation_suite)

        # Create artifact
        artifact = ValidationArtifact(
            artifact_id=artifact_id,
            suite_name=suite_name,
            success=result.get("success", False),
            result=result,
        )

        # Persist to disk
        artifact_path = self._persist_artifact(artifact)
        artifact.artifact_path = artifact_path

        _logger.info(
            "Checkpoint %s completed: success=%s, failed_count=%d, artifact=%s",
            suite_name,
            result.get("success"),
            result.get("failed_count", 0),
            artifact_path,
        )

        return artifact

    def _persist_artifact(self, artifact: ValidationArtifact) -> str:
        """Persist artifact to disk as JSON."""
        filename = f"{artifact.artifact_id}.json"
        filepath = os.path.join(self.artifact_store_path, filename)

        with open(filepath, "w") as f:
            json.dump(artifact.to_dict(), f, indent=2, default=str)

        return filepath

    def load_artifact(self, artifact_id: str) -> ValidationArtifact | None:
        """Load a persisted artifact by ID."""
        filepath = os.path.join(self.artifact_store_path, f"{artifact_id}.json")
        if not os.path.exists(filepath):
            return None

        with open(filepath) as f:
            data = json.load(f)

        return ValidationArtifact(
            artifact_id=data["artifact_id"],
            suite_name=data["suite_name"],
            success=data["success"],
            result=data["result"],
            timestamp=data["timestamp"],
            artifact_path=filepath,
        )

    def list_artifacts(self, suite_name: str | None = None) -> list[ValidationArtifact]:
        """List all persisted artifacts, optionally filtered by suite name."""
        artifacts = []
        for filename in os.listdir(self.artifact_store_path):
            if not filename.endswith(".json"):
                continue

            filepath = os.path.join(self.artifact_store_path, filename)
            with open(filepath) as f:
                data = json.load(f)

            if suite_name and data.get("suite_name") != suite_name:
                continue

            artifacts.append(
                ValidationArtifact(
                    artifact_id=data["artifact_id"],
                    suite_name=data["suite_name"],
                    success=data["success"],
                    result=data["result"],
                    timestamp=data["timestamp"],
                    artifact_path=filepath,
                )
            )

        # Sort by timestamp descending
        artifacts.sort(key=lambda a: a.timestamp, reverse=True)
        return artifacts

    def get_failed_checkpoints(self, suite_name: str | None = None) -> list[ValidationArtifact]:
        """Get all failed checkpoints for quarantine review."""
        all_artifacts = self.list_artifacts(suite_name)
        return [a for a in all_artifacts if not a.success]

    def should_quarantine(self, artifact: ValidationArtifact) -> bool:
        """Determine if a batch should be quarantined based on checkpoint result."""
        return not artifact.success

    def get_quarantined_batches(self) -> list[ValidationArtifact]:
        """Get all batches that failed validation (for quarantine)."""
        return self.get_failed_checkpoints()


def run_validation_checkpoint(
    suite_name: str,
    data: list[dict[str, Any]],
    expectation_suite: list[dict[str, Any]],
    job_id: str | None = None,
) -> ValidationArtifact:
    """Convenience function to run a checkpoint with default settings.

    Args:
        suite_name: Name of the expectation suite.
        data: Data to validate.
        expectation_suite: List of expectation definitions.
        job_id: Optional ingestion job ID.

    Returns:
        ValidationArtifact with result.
    """
    runner = CheckpointRunner()
    return runner.run_checkpoint(suite_name, data, expectation_suite, job_id)


def validate_and_checkpoint_dbwd(
    rates: list[dict[str, Any]],
    job_id: str | None = None,
) -> ValidationArtifact:
    """Validate DBWD rates and persist checkpoint artifact."""
    from wcp_backend.quality.dbwd_expectations import dbwd_expectation_suite

    suite = dbwd_expectation_suite()
    return run_validation_checkpoint(
        "dbwd_rates",
        rates,
        suite.get("expectations", []),
        job_id,
    )


def validate_and_checkpoint_contracts(
    contracts: list[dict[str, Any]],
    job_id: str | None = None,
) -> ValidationArtifact:
    """Validate contracts and persist checkpoint artifact."""
    from wcp_backend.quality.contract_expectations import contract_expectation_suite

    suite = contract_expectation_suite()
    return run_validation_checkpoint(
        "contracts",
        contracts,
        suite.get("expectations", []),
        job_id,
    )


def validate_and_checkpoint_payroll(
    records: list[dict[str, Any]],
    job_id: str | None = None,
) -> ValidationArtifact:
    """Validate payroll records and persist checkpoint artifact."""
    from wcp_backend.quality.payroll_expectations import payroll_expectation_suite

    suite = payroll_expectation_suite()
    return run_validation_checkpoint(
        "payroll_records",
        records,
        suite.get("expectations", []),
        job_id,
    )
