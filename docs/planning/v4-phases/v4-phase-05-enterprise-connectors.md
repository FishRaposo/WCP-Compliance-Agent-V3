# V4 Phase 5 — Enterprise Connectors

**Goal:** Build an extensible connector framework for pulling data from external enterprise systems (ERP, HR platforms, SFTP drops, direct database connections). V4.1 scope — framework + SFTP connector. Additional connectors added incrementally.

---

## Exit Criteria (Hard Gate)

```bash
cd backend
poetry run pytest tests/unit -v             # All tests pass

# Test BaseConnector ABC
poetry run python -c "
from wcp_backend.connectors.base import BaseConnector
import inspect
assert inspect.isabstract(BaseConnector)
print('BaseConnector is abstract: OK')
"

# Test connector registry
poetry run python -c "
from wcp_backend.connectors.registry import ConnectorRegistry
assert 'sftp' in ConnectorRegistry.list_types()
print('SFTP connector registered: OK')
"

# Test SFTP connector (with mock)
poetry run python -c "
from wcp_backend.connectors.sftp import SFTPConnector
connector = SFTPConnector()
# Would need real SFTP server or mock for full test
print('SFTP connector instantiates: OK')
"

# Test connector config CRUD
curl -X POST http://localhost:8000/v1/connectors -H 'Content-Type: application/json' -d '{
  "name": "test-sftp",
  "type": "sftp",
  "connection_config": {"host": "localhost", "port": 22, "remote_path": "/test/"},
  "schedule_cron": "0 */6 * * *"
}'
# → 201 Created

curl http://localhost:8000/v1/connectors
# → List includes test-sftp

curl -X DELETE http://localhost:8000/v1/connectors/test-sftp
# → 200 OK
```

**Do not declare Phase 5 complete until the connector framework is extensible and SFTP connector can connect to a test server.**

---

## Goals

1. Create BaseConnector ABC
2. Create connector registry
3. Implement SFTP connector
4. Implement API connector (generic REST)
5. Implement database connector (read replica)
6. Create connector config CRUD endpoints
7. Add Prefect flow for scheduled sync
8. Add connector tests with mocks

---

## Task Breakdown

### 5.1 — Create BaseConnector ABC

**Destination:** `backend/src/wcp_backend/connectors/base.py`

```python
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any

class ConnectorResult:
    def __init__(self, records: list[dict], metadata: dict[str, Any] | None = None):
        self.records = records
        self.metadata = metadata or {}
        self.count = len(records)

class BaseConnector(ABC):
    @abstractmethod
    async def connect(self, config: dict[str, Any]) -> None:
        ...

    @abstractmethod
    async def fetch(self, since: datetime | None = None) -> ConnectorResult:
        ...

    @abstractmethod
    async def validate(self, records: list[dict]) -> tuple[list[dict], list[dict]]:
        ...

    @abstractmethod
    async def disconnect(self) -> None:
        ...

    @property
    @abstractmethod
    def connector_type(self) -> str:
        ...
```

---

### 5.2 — Create Connector Registry

**Destination:** `backend/src/wcp_backend/connectors/registry.py`

```python
from typing import Type
from .base import BaseConnector

_registry: dict[str, Type[BaseConnector]] = {}

def register(connector_type: str):
    def decorator(cls: Type[BaseConnector]):
        _registry[connector_type] = cls
        return cls
    return decorator

def get_connector(connector_type: str) -> Type[BaseConnector]:
    if connector_type not in _registry:
        raise ValueError(f"Unknown connector type: {connector_type}. Available: {list(_registry.keys())}")
    return _registry[connector_type]

def list_types() -> list[str]:
    return list(_registry.keys())
```

---

### 5.3 — Implement SFTP Connector

**Destination:** `backend/src/wcp_backend/connectors/sftp.py`

```python
import asyncssh
from datetime import datetime
from typing import Any
from .base import BaseConnector, ConnectorResult
from .registry import register
from ..quality.payroll_expectations import validate_payroll_records

@register("sftp")
class SFTPConnector(BaseConnector):
    def __init__(self):
        self._conn = None
        self._config: dict[str, Any] = {}

    @property
    def connector_type(self) -> str:
        return "sftp"

    async def connect(self, config: dict[str, Any]) -> None:
        self._config = config
        self._conn = await asyncssh.connect(
            host=config["host"],
            port=config.get("port", 22),
            username=config.get("username"),
            client_keys=[config["key_path"]] if "key_path" in config else None,
            known_hosts=None,
        )

    async def fetch(self, since: datetime | None = None) -> ConnectorResult:
        if not self._conn:
            raise RuntimeError("Not connected. Call connect() first.")

        remote_path = self._config.get("remote_path", "/")
        file_pattern = self._config.get("file_pattern", "*.csv")

        async with self._conn.start_sftp_client() as sftp:
            files = await sftp.glob(f"{remote_path}/{file_pattern}")
            records = []
            for file_path in files:
                if since:
                    stat = await sftp.stat(file_path)
                    if stat.mtime < since.timestamp():
                        continue
                content = await sftp.read(file_path)
                parsed = self._parse_csv(content)
                records.extend(parsed)

        return ConnectorResult(records, {"files_processed": len(files)})

    async def validate(self, records: list[dict]) -> tuple[list[dict], list[dict]]:
        return validate_payroll_records(records)

    async def disconnect(self) -> None:
        if self._conn:
            self._conn.close()
            self._conn = None

    def _parse_csv(self, content: str) -> list[dict]:
        import csv
        import io
        reader = csv.DictReader(io.StringIO(content))
        return list(reader)
```

**Dependency:** Add `asyncssh` to `pyproject.toml`.

---

### 5.4 — Implement API Connector

**Destination:** `backend/src/wcp_backend/connectors/api_client.py`

```python
import httpx
from datetime import datetime
from typing import Any
from .base import BaseConnector, ConnectorResult
from .registry import register

@register("api")
class APIConnector(BaseConnector):
    def __init__(self):
        self._client: httpx.AsyncClient | None = None
        self._config: dict[str, Any] = {}

    @property
    def connector_type(self) -> str:
        return "api"

    async def connect(self, config: dict[str, Any]) -> None:
        self._config = config
        headers = {}
        if config.get("auth_type") == "bearer":
            headers["Authorization"] = f"Bearer {config['token']}"
        self._client = httpx.AsyncClient(
            base_url=config["base_url"],
            headers=headers,
            timeout=30.0,
        )

    async def fetch(self, since: datetime | None = None) -> ConnectorResult:
        if not self._client:
            raise RuntimeError("Not connected")

        endpoint = self._config.get("endpoint", "/payrolls")
        params = {}
        if since:
            params["since"] = since.isoformat()

        response = await self._client.get(endpoint, params=params)
        response.raise_for_status()
        data = response.json()

        records = data if isinstance(data, list) else data.get("records", data.get("data", []))
        return ConnectorResult(records)

    async def validate(self, records: list[dict]) -> tuple[list[dict], list[dict]]:
        from ..quality.payroll_expectations import validate_payroll_records
        return validate_payroll_records(records)

    async def disconnect(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None
```

---

### 5.5 — Implement Database Connector

**Destination:** `backend/src/wcp_backend/connectors/database.py`

```python
import asyncpg
from datetime import datetime
from typing import Any
from .base import BaseConnector, ConnectorResult
from .registry import register

@register("database")
class DatabaseConnector(BaseConnector):
    def __init__(self):
        self._conn = None
        self._config: dict[str, Any] = {}

    @property
    def connector_type(self) -> str:
        return "database"

    async def connect(self, config: dict[str, Any]) -> None:
        self._config = config
        dsn = f"postgresql://{config['username']}:{config['password']}@{config['host']}:{config.get('port', 5432)}/{config['database']}"
        self._conn = await asyncpg.connect(dsn)

    async def fetch(self, since: datetime | None = None) -> ConnectorResult:
        if not self._conn:
            raise RuntimeError("Not connected")

        query = self._config.get("query", "SELECT * FROM payroll_weekly")
        params = []
        if since and ":last_sync" in query:
            params.append(since)
        rows = await self._conn.fetch(query, *params)
        records = [dict(r) for r in rows]
        return ConnectorResult(records)

    async def validate(self, records: list[dict]) -> tuple[list[dict], list[dict]]:
        from ..quality.payroll_expectations import validate_payroll_records
        return validate_payroll_records(records)

    async def disconnect(self) -> None:
        if self._conn:
            await self._conn.close()
            self._conn = None
```

---

### 5.6 — Create Connector CRUD Endpoints

**Destination:** `backend/src/wcp_backend/connectors/router.py`

```python
from fastapi import APIRouter, HTTPException
from . import schemas

router = APIRouter(prefix="/connectors", tags=["connectors"])

@router.get("/", response_model=list[schemas.ConnectorConfigResponse])
async def list_connectors(): ...

@router.post("/", status_code=201, response_model=schemas.ConnectorConfigResponse)
async def create_connector(config: schemas.ConnectorConfigCreate): ...

@router.get("/{name}", response_model=schemas.ConnectorConfigResponse)
async def get_connector(name: str): ...

@router.put("/{name}", response_model=schemas.ConnectorConfigResponse)
async def update_connector(name: str, config: schemas.ConnectorConfigUpdate): ...

@router.delete("/{name}")
async def delete_connector(name: str): ...

@router.post("/{name}/test", response_model=schemas.ConnectorTestResult)
async def test_connector(name: str): ...

@router.post("/{name}/sync", response_model=schemas.SyncResult)
async def trigger_sync(name: str): ...
```

**Schemas:** `backend/src/wcp_backend/connectors/schemas.py`

```python
from pydantic import BaseModel

class ConnectorConfigCreate(BaseModel):
    name: str
    type: str  # "sftp" | "api" | "database"
    connection_config: dict
    schedule_cron: str | None = None

class ConnectorConfigResponse(BaseModel):
    id: str
    name: str
    type: str
    connection_config: dict
    schedule_cron: str | None
    last_sync_at: str | None
    last_sync_status: str | None
    is_active: bool
    created_at: str

class ConnectorTestResult(BaseModel):
    success: bool
    message: str
    records_found: int | None = None

class SyncResult(BaseModel):
    job_id: str
    status: str
    message: str
```

---

### 5.7 — Create Scheduled Sync Flow

**Destination:** `backend/src/wcp_backend/pipelines/connector_sync.py`

```python
from prefect import flow, task, get_run_logger
from ..connectors.registry import get_connector
from ..connectors.base import BaseConnector

@task
async def run_sync(connector_name: str, config: dict) -> dict:
    connector_cls = get_connector(config["type"])
    connector = connector_cls()

    try:
        await connector.connect(config["connection_config"])
        result = await connector.fetch(since=config.get("last_sync_at"))
        valid, invalid = await connector.validate(result.records)
        return {"valid": len(valid), "invalid": len(invalid), "total": result.count}
    finally:
        await connector.disconnect()

@flow(name="connector-sync")
async def connector_sync_flow(connector_name: str, config: dict):
    logger = get_run_logger()
    result = await run_sync(connector_name, config)
    logger.info(f"Sync {connector_name}: {result}")
    return result
```

---

### 5.8 — Add Connector Tests

**Destination:** `backend/tests/unit/test_connectors.py`

```python
import pytest
from wcp_backend.connectors.base import BaseConnector
from wcp_backend.connectors.registry import get_connector, list_types

class TestConnectorRegistry:
    def test_sftp_registered(self):
        assert "sftp" in list_types()

    def test_api_registered(self):
        assert "api" in list_types()

    def test_database_registered(self):
        assert "database" in list_types()

    def test_unknown_type_raises(self):
        with pytest.raises(ValueError, match="Unknown connector type"):
            get_connector("nonexistent")

class TestBaseConnector:
    def test_is_abstract(self):
        import inspect
        assert inspect.isabstract(BaseConnector)

class TestSFTPConnector:
    def test_instantiation(self):
        cls = get_connector("sftp")
        connector = cls()
        assert connector.connector_type == "sftp"
```

**Minimum: 6 connector tests**

---

## Architecture Notes

### Extensible by Design
New connectors are added by:
1. Creating a new file in `connectors/`
2. Implementing `BaseConnector`
3. Using the `@register("type")` decorator
4. No changes to router, registry, or sync flow

### Config in Database, Not Code
Connector configurations (host, credentials references, schedule) are stored in `connector_configs` table. No connector details in code or env vars. Credentials are referenced via vault paths, not stored directly.

### Scheduled Sync via Prefect
Each connector config has a `schedule_cron` field. A Prefect deployment reads active connectors and creates scheduled flows. Sync is pull-based (V4 fetches from external systems, never receives pushes).

### V4.1 Scope
This phase delivers the framework and SFTP connector. API and database connectors are implemented but may need customization per enterprise system. Additional connector types (SMB, FTP, message queue) are V4.2+.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| asyncssh not available on Windows | Medium | Medium | Use paramiko as fallback. asyncssh preferred for async |
| External system auth changes | Medium | High | Config in DB allows quick update. Test endpoint verifies connectivity |
| Large sync overwhelms DB | Low | Medium | Batch processing + Prefect rate limiting. GE validation before write |
| Credential storage security | Medium | High | Reference vault paths, not actual credentials. Document security model |

---

## Command Reference

```bash
cd backend
poetry add asyncssh
poetry install
poetry run pytest tests/unit/test_connectors.py -v

# Test registry
poetry run python -c "from wcp_backend.connectors.registry import list_types; print(list_types())"
```

---

*Phase 5 document version: 2026-04-30*
*Blocked by: Phase 2 (data pipelines) — uses Prefect for scheduled sync*
