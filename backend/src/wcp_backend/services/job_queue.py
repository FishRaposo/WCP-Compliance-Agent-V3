"""Celery task definitions for async job processing."""

from __future__ import annotations

from celery import Celery

from wcp_backend.config import settings

celery_app = Celery("wcp_backend", broker=settings.celery_broker_url)
celery_app.config_from_object("celeryconfig")


@celery_app.task(bind=True, max_retries=3)
def process_payroll_batch(self, job_id: str, payloads: list[dict]) -> dict:
    """Process a batch of WCP payloads asynchronously."""
    # TODO: implement
    raise NotImplementedError


@celery_app.task
def run_eval(eval_config: dict) -> dict:
    """Run golden set evaluation in background."""
    # TODO: implement
    raise NotImplementedError
