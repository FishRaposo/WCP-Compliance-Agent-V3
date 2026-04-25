# ADR-001: Mastra over LangChain

Status: **Accepted**

Date: January 2024

## Context

We needed an AI orchestration framework for the WCP Compliance Agent. The system requires:
- Structured output validation (Zod schemas)
- Prompt versioning and A/B testing
- Tool integration (deterministic + LLM)
- TypeScript-first development
- Observable execution traces

Options considered:
1. **LangChain** - Most popular, large ecosystem
2. **Mastra** - Newer, TypeScript-first, opinionated
3. **LlamaIndex** - Strong for RAG, Python-heavy
4. **Custom implementation** - Full control, higher maintenance

## Decision

**We will use Mastra as our AI orchestration framework.**

## Rationale

### Why Mastra won

| Criteria | LangChain | Mastra | Winner |
|----------|-----------|--------|--------|
| TypeScript native | ❌ Transpiled | ✅ First-class | Mastra |
| Schema validation | ⚠️ Partial | ✅ Zod native | Mastra |
| Prompt versioning | ⚠️ Manual | ✅ Built-in | Mastra |
| Bundle size | ❌ Large | ✅ Small | Mastra |
| Documentation | ⚠️ Scattered | ✅ Clear | Mastra |
| Community | ✅ Huge | ⚠️ Growing | LangChain |
| Production proven | ✅ Yes | ⚠️ Newer | LangChain |

### Key differentiators

1. **TypeScript-first**: No type gymnastics, full IntelliSense
2. **Zod schemas**: Output validation at the framework level
3. **Prompt workflows**: Version control for prompts
4. **Smaller footprint**: Less bundle bloat for serverless

### LangChain tradeoffs accepted

- Smaller community (growing fast)
- Fewer pre-built integrations (we build our own anyway)
- Less Stack Overflow help (clear docs compensate)

## Consequences

### Positive

- Type safety from input to output
- Schema violations caught before API response
- Clean tool abstraction (deterministic vs LLM)
- Easy prompt experimentation with versioning

### Negative

- Smaller ecosystem means building some utilities ourselves
- Newer framework means occasional breaking changes
- Less community Stack Overflow support

### Mitigations

- Pin Mastra to specific version in package.json
- Abstract Mastra-specific code behind interfaces
- Contribute fixes upstream to build community

## Alternatives considered

### LangChain

LangChain is the industry standard with the largest ecosystem. However:
- TypeScript support is second-class (originally Python)
- Bundle size is large (~500KB+)
- Documentation is fragmented across versions
- Schema validation requires additional libraries

**Verdict**: Good for rapid prototyping, but we want type safety first.

### LlamaIndex

LlamaIndex is excellent for RAG applications. However:
- TypeScript port lags behind Python
- Heavier framework than we need
- Tightly coupled to vector storage assumptions

**Verdict**: Overkill for our needs; we'll build targeted retrieval.

### Custom implementation

Building our own orchestration would give full control. However:
- High maintenance burden
- Reinventing solved problems (tracing, retries, streaming)
- Diverts effort from domain-specific logic

**Verdict**: Not worth the overhead for this stage.

## Implementation notes

```typescript
// Example Mastra usage in our codebase
import { createTool } from '@mastra/core';
import { z } from 'zod';

export const extractWCPTool = createTool({
  id: 'extract-wcp',
  description: 'Extract WCP data from text',
  inputSchema: z.object({ payload: z.string() }),
  outputSchema: WCPDataSchema,  // Zod validation happens automatically
  execute: async ({ payload }) => {
    // Implementation
  },
});
```

## References

- [Mastra Documentation](https://mastra.ai/docs)
- [Mastra GitHub](https://github.com/mastra-ai/mastra)
- [LangChain.js](https://js.langchain.com/)
- [Comparison: Mastra vs LangChain](https://mastra.ai/blog/mastra-vs-langchain)

## Status

- **Proposed**: January 2024
- **Accepted**: January 2024
- **Last reviewed**: January 2024
