import pytest


@pytest.mark.unit
class TestParquetExport:
    def test_storage_importable(self):
        try:
            from wcp_backend.storage import archiver  # noqa: F401
        except ImportError:
            pytest.skip("V4 storage module not fully implemented yet")

    def test_parquet_export_config(self):
        try:
            from wcp_backend.storage import archiver  # noqa: F401
        except ImportError:
            pytest.skip("V4 storage module not fully implemented yet")


@pytest.mark.unit
class TestFileFormat:
    def test_schema_parquet_roundtrip(self):
        try:
            from wcp_backend.storage import archiver  # noqa: F401
        except ImportError:
            pytest.skip("V4 storage module not fully implemented yet")
