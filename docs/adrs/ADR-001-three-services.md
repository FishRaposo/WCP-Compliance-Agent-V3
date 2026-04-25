# ADR-001: Three-Service Architecture (Python + TypeScript + React)

**Status:** Accepted

**Date:** 2026-04-22

**Author:** Vinícius Raposo

---

## Context

V3 is a production AI compliance system using polyglot architecture. The architecture must satisfy:

1. **TypeScript agent orchestration** — Mastra.ai framework for LLM reasoning
2. **Python deterministic backend** — RAG pipelines, validation, testing infrastructure

The V2 monolith was TypeScript-only. A single-language architecture forces compromises: TypeScript is suboptimal for CPU-bound validation, while Python lacks a mature agent framework equivalent to Mastra.

---

## Decision

Split V3 into three services:

| Service | Technology | Responsibility |
|---|---|---|
| **Agent Gateway (Integration Layer)** | TypeScript / Hono / Mastra.ai | Integration middleware, external APIs, LLM orchestration |
| **Backend** | Python / FastAPI | Deterministic logic, RAG, data systems, eval |
| **Frontend** | React 19 | Product UI |

**Agent Gateway as Integration Layer:**
- Middleware: auth, rate limiting, request validation, CORS
- External API integration: SAM.gov, third-party services
- Cross-service orchestration: coordinates frontend → backend → LLM → response
- LLM reasoning: Mastra.ai orchestration with tool-use
- Single integration point for all external services

---

## Rationale

### Why Not 2 Services?

Option A: Python-only (collapse agent into backend)
- ❌ Mastra.ai requires TypeScript — no Python equivalent for agent orchestration
- ❌ V2 TypeScript investment would be wasted
- ❌ Less impressive as a polyglot architecture

Option B: TypeScript-only (keep V2 architecture)
- ❌ Hybrid RAG + eval pipelines require Python ecosystem
- ❌ Deterministic validation better suited to Python's testing infrastructure

**3 services is the minimum that covers all architectural requirements.**

---

## Consequences

**Positive:**
- Demonstrates polyglot architecture with clear service boundaries
- Each service uses the right language for the job
- **Service independence:** Each layer testable in isolation with mocks
- **Clear validation boundary:** Python owns all deterministic scaffolding (testing, validation, golden set); TypeScript defers to Python for "provable correctness"
- Three-layer separation provides defense in depth for federal compliance

**Architectural Rationale:**

- **Node.js for I/O-bound orchestration:** External API calls (SAM.gov), middleware (auth, rate limiting), and cross-service coordination are I/O-bound. Node.js's event loop handles concurrent requests efficiently without Python's GIL constraints.

- **Python for CPU-bound validation:** PDF extraction, wage calculations, rule validation, and testing are CPU-bound. Python's ecosystem (pytest, Pydantic, pandas) excels at rigorous data processing and deterministic correctness.

- **Resilience for federal compliance:** Three layers provides defense in depth. Frontend can't accidentally call backend directly. Python validation layer ensures "provable correctness" separate from LLM reasoning. If backend degrades, Node.js can queue/cache/fallback.

**Negative:**
- More operational overhead (3 Dockerfiles, 3 CI pipelines)
- Inter-service latency (local Docker network, negligible)
- Contract testing between agent and backend

**Mitigated by:**
- Shared JSON Schema contracts in `shared/schemas/`
- Pydantic (Python) + Zod (TypeScript) for validation
- OpenTelemetry for distributed tracing

---

## Alternatives Considered

| Approach | Verdict |
|---|---|
| Python-only backend | Rejected — misses Mastra.ai requirement |
| TypeScript monolith (V2 extension) | Rejected — misses Python backend requirement |
| TypeScript BFF + Python API | Rejected — BFF would be too thin, misses agent orchestration story |

---

## Related

- ADR-002: Why Mastra.ai for Agent Orchestration
- ADR-008: Why `redis.asyncio` over aioredis
