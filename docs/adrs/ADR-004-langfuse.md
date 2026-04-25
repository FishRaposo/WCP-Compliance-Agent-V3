# ADR-004: Langfuse for Prompt Infrastructure

**Status:** Accepted

**Date:** 2026-04-22

**Author:** Vinícius Raposo

---

## Context

The AI compliance system requires prompt versioning, A/B testing, per-account configuration, and cost tracking for production LLM deployments.

The system needs:
- Prompt versioning (every change tracked)
- A/B testing (route 50/50 to v1/v2, compare metrics)
- Per-account configuration (different prompts for different contractor tiers)
- Cost tracking (per model, per prompt, per decision)

---

## Decision

Use **Langfuse** for prompt infrastructure across both TypeScript and Python services.

---

## Rationale

**Infrastructure Requirement:**
- Prompt versioning with rollback capabilities
- A/B testing between prompt versions
- Per-account configuration
- Cost tracking per decision

**Technical Fit:**
- TypeScript SDK: `langfuse` for agent layer
- Python SDK: `langfuse` for backend (optional, for direct LLM calls)
- Langfuse Cloud (hosted) or self-hosted Docker
- Integrates with Mastra, OpenAI SDK, Phoenix

**Integration Pattern:**
- Agent calls Langfuse to fetch prompt version
- Prompt includes metadata: `version`, `ab_test_group`, `org_id`
- Langfuse tracks: input/output tokens, latency, cost
- Metrics feed back into A/B decision logic

---

## Why Langfuse Over Alternatives?

| Tool | Comparison |
|---|---|
| **Weights & Biases** | ML experiment tracking, not prompt management |
| **Phoenix** | Observability + evaluation, but weaker prompt versioning |
| **LangSmith** | Similar features, but SaaS-only, LangChain-centric |
| **Custom DB** | Would reinvent the wheel; Langfuse is purpose-built |

Langfuse fills a specific niche: production prompt operations.

---

## Architecture

```
┌──────────────────┐     ┌──────────────────┐
│  TypeScript Agent│     │  Python Backend  │
│  (Mastra)        │     │  (FastAPI)       │
└──────┬───────────┘     └──────┬───────────┘
       │ Langfuse SDK            │ Langfuse SDK (optional)
       └───────────┬─────────────┘
                   ▼
         ┌──────────────────┐
         │  Langfuse Cloud  │
         │  or Self-Hosted  │
         │  Prompt registry │
         │  A/B config      │
         │  Cost aggregation│
         └──────────────────┘
```

---

## Consequences

**Positive:**
- Comprehensive prompt infrastructure for production (4/4 requirements)
- Works across TypeScript and Python
- Self-hosted option (data privacy)

**Negative:**
- External dependency (or another Docker service)
- Free tier limits (upgrade if scale exceeds)

---

## Complementary: Phoenix + Langfuse

| Tool | Primary Role |
|---|---|
| **Phoenix** | LLM tracing, observability, drift detection |
| **Langfuse** | Prompt versioning, A/B testing, cost tracking |

They serve different purposes. Use both.

---

## Related

- ADR-002: Mastra.ai (Langfuse integrates with Mastra)
- ADR-003: Phoenix (complementary observability)
