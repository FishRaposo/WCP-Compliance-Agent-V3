# ADR-003: Phoenix/Arize for LLM Observability

**Status:** Accepted

**Date:** 2026-04-22

**Author:** Vinícius Raposo

---

## Context

The AI compliance system requires comprehensive observability for LLM calls, including trace visualization, prompt evaluation, and cost tracking.

The system needs:
- LLM call tracing (prompts, completions, latency, token usage)
- Prompt evaluation and drift detection
- Trace visualization for debugging
- Cost tracking per decision

---

## Decision

Use **Arize Phoenix** for LLM observability in both Python backend and TypeScript agent.

---

## Rationale

**Observability Requirement:**
- LLM-specific trace visualization and debugging
- Integration with TypeScript agent and Python backend

**Technical Fit:**
- Python SDK: `arize-phoenix` auto-instruments OpenAI, LangChain calls
- TypeScript/Node: `phoenix-client` for JS SDK
- Self-hosted via Docker (no external SaaS dependency)
- Trace visualization UI on port 6006

**Integration Points:**
- Python: Phoenix tracer around FastAPI endpoints and LLM calls
- TypeScript: Phoenix client traces Mastra agent execution
- OpenTelemetry export for cross-service trace correlation

---

## Why Phoenix Over Alternatives?

| Tool | Comparison |
|---|---|
| **LangSmith** | SaaS-only (no self-host), LangChain-centric |
| **Weights & Biases** | ML experiment tracking, not LLM-specific tracing |
| **Honeycomb** | General observability, not LLM-specialized |
| **Custom logging** | Would miss the Phoenix requirement entirely |

Phoenix is purpose-built for LLM applications:
- Prompt/response storage
- Latency/token tracking
- Prompt drift detection
- Embedding visualization (future)

---

## Architecture

```
┌──────────────────┐     ┌──────────────────┐
│  TypeScript Agent │     │  Python Backend  │
│  (Mastra)         │     │  (FastAPI)       │
└──────┬───────────┘     └──────┬───────────┘
       │ Phoenix trace           │ Phoenix trace
       └───────────┬─────────────┘
                   ▼
         ┌──────────────────┐
         │  Arize Phoenix   │
         │  Port 6006       │
         │  Trace viz UI    │
         └──────────────────┘
```

---

## Consequences

**Positive:**
- Comprehensive LLM observability across services
- LLM-specific observability (not generic APM)
- Self-hosted (data stays in Docker network)
- Integrates with Langfuse for cost tracking (complementary)

**Negative:**
- Another service in Docker Compose (adds RAM usage)
- v0.x software (API may change)

---

## Related

- ADR-001: Three-Service Architecture
- ADR-004: Langfuse for Prompt Infrastructure (complementary, not competing)
