# ADR-002: Mastra.ai for Agent Orchestration

**Status:** Accepted

**Date:** 2026-04-22

**Author:** Vinícius Raposo

---

## Context

The TypeScript agent layer requires a mature framework for LLM orchestration with tool-use and structured output capabilities.

The TS agent layer needs:
1. LLM orchestration with tool-use
2. Structured output (Pydantic-equivalent in TS)
3. Agent workflows (multi-step reasoning)
4. Integration with external APIs (Python backend, OpenAI)

---

## Decision

Use **Mastra.ai v0.x** for agent orchestration in the TypeScript service.

---

## Rationale

**Framework Selection:**
- Mastra provides TypeScript-native agent orchestration
- Structured output via Zod schemas matches our validation approach

**Technical Fit:**
- Native TypeScript (no Python interop needed in agent layer)
- Structured output via Zod schemas
- Tool-use pattern: `extract`, `validate`, `search`, `dbwd_lookup`, `persist`
- Workflow support for the three-layer pipeline

**Ecosystem:**
- Built by the same team as AI SDK (Vercel)
- Integrates with Langfuse for prompt management
- Growing community, docs improving

---

## Why Not Python Agent Frameworks?

| Framework | Why Not |
|---|---|
| **LangGraph** | TypeScript agent layer requires TS-native framework; LangGraph is Python-only |
| **CrewAI** | Python-only, more opinionated, less structured output focus |
| **Autogen** | Microsoft stack, overkill for this use case |
| **Build custom** | Would require significant investment for equivalent capabilities |

---

## Consequences

**Positive:**
- TypeScript-native agent orchestration with structured output
- TypeScript-native (no language bridge in agent layer)
- Vercel AI SDK integration for streaming, model routing

**Negative:**
- Mastra is v0.x (early, API may change)
- Less mature than Python alternatives
- Requires separate Python service for deterministic logic

**Mitigation:**
- Pin Mastra version in `package.json`
- Abstract Mastra-specific code behind `agent/src/mastra/` module
- If Mastra breaks, the tool-use pattern ports easily to other frameworks

---

## Integration Pattern

```
Mastra Agent (TypeScript)
├── Tool: extract → POST python-backend/extract
├── Tool: validate → POST python-backend/validate
├── Tool: dbwd_lookup → GET python-backend/dbwd/{trade}/{locality}
├── Tool: search → POST python-backend/search (RAG)
└── Tool: persist → POST python-backend/decisions
```

Agent handles orchestration; Python handles execution.

---

## Related

- ADR-001: Three-Service Architecture
- ADR-004: Langfuse for Prompt Infrastructure
