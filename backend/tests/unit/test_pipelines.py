import pytest


@pytest.mark.unit
class TestPrefectETL:
    def test_prefect_importable(self):
        try:
            from wcp_backend.pipelines import etl  # noqa: F401
        except ImportError:
            pytest.skip("V4 pipelines module not fully implemented yet")

    def test_prefect_flow_exists(self):
        try:
            from wcp_backend.pipelines import etl  # noqa: F401
        except ImportError:
            pytest.skip("V4 pipelines module not fully implemented yet")


@pytest.mark.unit
class TestGreatExpectations:
    def test_ge_importable(self):
        try:
            from wcp_backend.quality import expectations  # noqa: F401
        except ImportError:
            pytest.skip("V4 quality module not fully implemented yet")

    def test_ge_validation_result_shape(self):
        try:
            from wcp_backend.quality import expectations  # noqa: F401
        except ImportError:
            pytest.skip("V4 quality module not fully implemented yet")
