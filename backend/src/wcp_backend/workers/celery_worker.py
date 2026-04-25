"""Celery worker entrypoint — import tasks to register them with Celery."""

from wcp_backend.services.job_queue import celery_app, process_payroll_batch, run_eval

__all__ = ["celery_app", "process_payroll_batch", "run_eval"]
