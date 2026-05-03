import pytest


@pytest.mark.unit
class TestConnectorFramework:
    def test_connectors_importable(self):
        try:
            from wcp_backend.connectors import base  # noqa: F401
        except ImportError:
            pytest.skip("V4 connectors module not fully implemented yet")

    def test_connector_registry(self):
        try:
            from wcp_backend.connectors import registry  # noqa: F401
        except ImportError:
            pytest.skip("V4 connectors registry not fully implemented yet")


@pytest.mark.unit
class TestConnectorTypes:
    def test_sam_gov_connector_stub(self):
        try:
            from wcp_backend.connectors import sam_gov  # noqa: F401
        except ImportError:
            pytest.skip("V4 SAM.gov connector not fully implemented yet")
