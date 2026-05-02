from importlib import import_module


V4_MODULES = (
    "analytics",
    "contracts",
    "payrolls",
    "ingestion",
    "events",
    "quality",
    "storage",
    "connectors",
    "pipelines",
)


def test_v4_scaffold_modules_are_import_safe() -> None:
    for module_name in V4_MODULES:
        module = import_module(f"wcp_backend.{module_name}")
        assert module.MODULE_OWNER == "v4"


def test_v4_route_prefixes_are_reserved() -> None:
    route_modules = {
        "analytics": "/v4/analytics",
        "contracts": "/v4/contracts",
        "payrolls": "/v4/payrolls",
        "ingestion": "/v4/ingestion",
    }

    for module_name, route_prefix in route_modules.items():
        module = import_module(f"wcp_backend.{module_name}")
        assert module.ROUTE_PREFIX == route_prefix
