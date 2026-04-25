import os

broker_url = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")
result_backend = os.environ.get("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")

task_serializer = "json"
result_serializer = "json"
accept_content = ["json"]
timezone = "UTC"
enable_utc = True

task_routes = {
    "wcp_backend.workers.celery_worker.process_payroll_batch": {"queue": "batch"},
    "wcp_backend.workers.celery_worker.run_eval": {"queue": "eval"},
}

task_soft_time_limit = 300
task_time_limit = 600
