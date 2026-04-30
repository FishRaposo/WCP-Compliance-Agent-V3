# ADR-017: Extensible Connector Framework for Enterprise Integration

**Status:** Accepted

**Date:** 2026-04-30

**Author:** Vinícius Raposo

---

## Context

V4 needs to pull contract and payroll data from external enterprise systems: ERP platforms, HR systems, SFTP drops, direct database connections. Each external system has different protocols, authentication, and data formats. The integration layer must be extensible — new connector types should be added without modifying existing code.

Options:
1. **Custom integration per system:** Hard-coded connectors
2. **Abstract base class + registry:** Plugin-style connector framework
3. **Apache NiFi:** Visual data integration platform
4. **Fivetran / Airbyte:** Managed ELT connectors

---

## Decision

Use an **abstract base class with decorator-based registry** pattern for the connector framework.

---

## Rationale

**Extensibility without modification:**
- New connectors are added by creating a new file and using `@register("type")`
- Router, registry, and sync flow never change when a new connector is added
- Open/closed principle: open for extension, closed for modification

**Consistent interface:**
- Every connector implements `connect()`, `fetch()`, `validate()`, `disconnect()`
- Prefect sync flow works with any connector via the abstract interface
- Testing uses mock connectors that implement the same ABC

**Lightweight:**
- No external framework dependency (pure Python ABC + decorator)
- No visual UI needed (connectors configured via API/database)
- No managed service dependency

**Why not NiFi/Airbyte:**
- NiFi is a full platform (separate JVM service, UI, flow management)
- Airbyte/Fivetran are managed services (cost, vendor dependency)
- V4 has 3-5 connector types, not 100+

**Why not hard-coded integrations:**
- Each new system requires changes to router, service, and flow code
- No consistent interface — testing each integration is unique
- Violates open/closed principle

---

## Technical Implementation

```python
# Abstract base class
class BaseConnector(ABC):
    @abstractmethod
    async def connect(self, config: dict) -> None: ...
    @abstractmethod
    async def fetch(self, since: datetime | None = None) -> ConnectorResult: ...
    @abstractmethod
    async def validate(self, records: list[dict]) -> tuple[list[dict], list[dict]]: ...
    @abstractmethod
    async def disconnect(self) -> None: ...

# Registry with decorator
_registry: dict[str, Type[BaseConnector]] = {}

def register(connector_type: str):
    def decorator(cls):
        _registry[connector_type] = cls
        return cls
    return decorator

# Concrete connector
@register("sftp")
class SFTPConnector(BaseConnector):
    async def connect(self, config): ...
    async def fetch(self, since=None): ...
    async def validate(self, records): ...
    async def disconnect(self): ...
```

---

## Connector Types (V4.1)

| Type | Protocol | Use Case |
|---|---|---|
| `sftp` | SSH/SFTP | CSV/PDF drops from contractor systems |
| `api` | HTTP REST | ERP/HR system API endpoints |
| `database` | PostgreSQL/MySQL | Read replica connections |

**Future connector types (V4.2+):** `ftp`, `smb`, `message_queue`, `odbc`

---

## Configuration Storage

Connector configurations are stored in the `connector_configs` database table:

- Connection details (host, port, path, endpoint)
- Authentication references (vault paths, not actual credentials)
- Schedule (cron expression)
- Last sync status and timestamp

Configuration is managed via REST API (`/api/connectors`), not code changes.

---

## Consequences

**Positive:**
- New connectors added without modifying existing code
- Consistent testing pattern (mock any connector via ABC)
- Configuration in database (no code changes for new integrations)
- Clean separation: framework code vs. connector implementations

**Negative:**
- Each connector needs custom error handling per protocol
- No built-in schema mapping (connector must normalize to expected format)
- Security: credential references need a vault/secrets manager in production

---

## Related

- ADR-012: Prefect (orchestrates connector sync as flows)
- ADR-014: Great Expectations (validators used by connector `validate()`)
- [V4 Phase 5](../planning/v4-phases/v4-phase-05-enterprise-connectors.md) — Full implementation plan
