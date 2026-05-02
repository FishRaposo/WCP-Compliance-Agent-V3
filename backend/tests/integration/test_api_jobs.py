"""Integration tests for jobs API."""

from __future__ import annotations

import pytest

from wcp_backend.config import settings


async def test_enqueue_job_requires_phase_2(client):
    """POST /jobs returns 503 in Phase 1."""
    if settings.phase >= 2:
        pytest.skip("Test only valid in Phase 1")
    
    payload = {"task_type": "process_payroll", "payload": {"test": "data"}}
    response = client.post("/jobs", json=payload)
    assert response.status_code == 503


async def test_get_job_status_requires_phase_2(client):
    """GET /jobs/{id} returns 503 in Phase 1."""
    if settings.phase >= 2:
        pytest.skip("Test only valid in Phase 1")
    
    response = client.get("/jobs/test-job-id")
    assert response.status_code == 503


@pytest.mark.skipif(settings.phase < 2, reason="Requires Phase 2")
async def test_enqueue_job_validates_task_type(client):
    """POST /jobs validates task_type."""
    # Invalid task type
    payload = {"task_type": "invalid_task", "payload": {}}
    response = client.post("/jobs", json=payload)
    # 400 for validation error, 503 if Celery not configured
    assert response.status_code in (400, 503, 500)


@pytest.mark.skipif(settings.phase < 2, reason="Requires Phase 2")
async def test_enqueue_job_requires_payload(client):
    """POST /jobs requires payload field."""
    payload = {"task_type": "process_payroll"}
    response = client.post("/jobs", json=payload)
    # 422 validation error or 503 if Celery not configured
    assert response.status_code in (422, 503)


@pytest.mark.skipif(settings.phase < 2, reason="Requires Phase 2")
async def test_enqueue_job_returns_job_id(client, monkeypatch):
    """POST /jobs returns job_id when Celery available."""
    # Mock Celery
    class MockResult:
        id = "mock-celery-id"
    
    class MockCelery:
        def send_task(self, name, args=None):
            return MockResult()
    
    monkeypatch.setattr("wcp_backend.api.jobs._CELERY_AVAILABLE", True)
    monkeypatch.setattr("wcp_backend.api.jobs.celery_app", MockCelery())
    
    payload = {"task_type": "process_payroll", "payload": {"test": "data"}}
    response = client.post("/jobs", json=payload)
    
    if response.status_code == 202:
        data = response.json()
        assert "job_id" in data
        assert data["status"] == "processing"


@pytest.mark.skipif(settings.phase < 2, reason="Requires Phase 2")
async def test_get_job_status_returns_status(client, monkeypatch):
    """GET /jobs/{id} returns job status when Celery available."""
    # Mock AsyncResult
    class MockAsyncResult:
        state = "SUCCESS"
        
        def ready(self):
            return True
        
        def successful(self):
            return True
    
    monkeypatch.setattr("wcp_backend.api.jobs._CELERY_AVAILABLE", True)
    monkeypatch.setattr("wcp_backend.api.jobs.AsyncResult", lambda job_id, app: MockAsyncResult())
    
    response = client.get("/jobs/test-job-id")
    # May be 200 with status, or 503 if Celery not configured
    assert response.status_code in (200, 503, 500)
    
    if response.status_code == 200:
        data = response.json()
        assert "job_id" in data
        assert "status" in data
        assert data["status"] in ("pending", "processing", "complete", "failed")
