# ADR-006: Celery for Async Task Queue

**Status:** Accepted

**Date:** 2026-04-22

**Author:** Vinícius Raposo

---

## Context

The AI compliance system requires async task processing for PDF ingestion, DBWD updates, and long-running evaluations.

---

## Decision

Use **Celery** with Redis broker and Flower monitoring.

---

## Rationale

**Infrastructure Requirement:**
- Async task processing for CPU-bound operations
- Distributed queue with persistence and monitoring
- Celery is the standard for Python task queues

**Alternative Considered: ARQ**
- ARQ is lighter, async-native, 500 LOC vs Celery's 30k+
- ARQ is arguably a better choice for new projects
- **Decision:** Keep Celery for recognizable production infrastructure patterns

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Python Backend (FastAPI)                                   │
│  POST /jobs → enqueues Celery task                          │
└─────────────────────┬───────────────────────────────────────┘
                      │ Redis broker
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Worker 1 │  │ Worker 2 │  │ Worker 3 │
│ extract  │  │ validate │  │ decision │
└──────────┘  └──────────┘  └──────────┘
        └─────────────┬─────────────┘
                      ▼
              ┌──────────┐
              │ Flower   │
              │ Port 5555│
              │ Monitor  │
              └──────────┘
```

---

## Task Types

| Task | Priority | Queue |
|---|---|---|
| PDF extraction | High | `extraction` |
| Batch CSV processing | Medium | `batch` |
| Golden set evaluation | Low | `eval` |
| DBWD re-indexing | Background | `indexing` |

---

## Consequences

**Positive:**
- Industry standard for Python task queues
- Flower UI for monitoring
- Multiple queues for priority handling
- Scales horizontally (add workers)

**Negative:**
- Heavier than alternatives (ARQ, RQ)
- Complex configuration surface
- Requires Redis + Flower services

**Mitigation:**
- Centralize config in `celeryconfig.py`
- Document common Celery pitfalls in `AGENTS.md`
- Start with single worker, scale as needed

---

## Related

- ADR-007: Why pgvector over dedicated vector DB (shared Redis for Celery + cache)
