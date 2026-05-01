from wcp_backend.ingestion.schemas import IngestionJobCreate
from wcp_backend.main import create_app


def test_ingestion_job_create_defaults_total_records() -> None:
    job = IngestionJobCreate(type="contract_import", source_type="csv")

    assert job.total_records == 0
    assert job.contract_id is None


def test_v4_routes_are_registered() -> None:
    app = create_app()
    paths = {route.path for route in app.routes}

    assert "/v4/contracts" in paths
    assert "/v4/payrolls" in paths
    assert "/v4/ingestion/jobs" in paths
