# Contributing to WCP Compliance Agent

Thank you for your interest in contributing. This project enforces strict architectural discipline — read this guide before opening a pull request.

---

## Development Setup

```bash
git clone https://github.com/FishRaposo/WCP-Compliance-Agent.git
cd WCP-Compliance-Agent
npm install

# Copy environment template
cp .env.example .env

# Run tests (mock mode — no API key needed)
OPENAI_API_KEY=mock npm test

# Start server
OPENAI_API_KEY=mock npm run serve
```

---

## Project Structure

```
src/pipeline/          # Three-layer decision pipeline (CORE — protected)
src/entrypoints/       # Public API entry points
src/retrieval/         # Hybrid BM25 + vector retrieval (Phase 02)
src/ingestion/         # PDF and CSV document ingestion
src/prompts/           # Versioned prompt registry
src/services/          # Audit persistence, human review queue, job queue
src/types/             # Typed decision contracts
src/utils/             # Logger, env validation, errors, mock responses
src/frontend/          # React demo UI (Vite + Tailwind)
src/app.ts             # Hono app factory (routes, CORS, rate limiting)
tests/unit/            # Unit tests
tests/integration/     # Decision pipeline integration tests
tests/eval/            # 102-example golden set (trust calibration)
tests/e2e/             # Playwright end-to-end tests
api/                   # Vercel serverless functions
docs/                  # Architecture, compliance, ADRs, v3 plan
data/                  # In-memory DBWD corpus, review queue
docs/v3/               # V3 architecture roadmap & transition guide
```

---

## Architecture Rules (Enforced)

The three-layer pipeline is protected by AST-based lint. **Violations are build failures.**

### Layer Boundaries

| Layer | Responsibility | Can Call | Cannot Call |
|---|---|---|---|
| Layer 1 | Deterministic extraction + validation | Utils, types | LLM APIs |
| Layer 2 | LLM reasoning over Layer 1 findings | Layer 1 results, prompts | Layer 1 extraction logic |
| Layer 3 | Trust scoring + routing | Layer 1 + 2 results | LLM APIs, extraction |

### Key Constraints

1. **Layer 1 never calls LLMs** — Pure arithmetic and policy rules
2. **Layer 2 never modifies Layer 1 values** — Can only interpret, not recompute
3. **Layer 3 never calls LLMs directly** — Only scores and routes
4. **Every decision has an audit trail** — Missing trail = build failure
5. **Every Layer 2 verdict cites regulations** — Missing citation = build failure

---

## Testing Requirements

All changes must pass:

```bash
npm run build        # TypeScript compilation (zero errors)
npm run lint:pipeline  # AST architectural lint
npm run test:unit    # 297 unit + integration tests
npm run test:coverage  # ≥80% coverage gate
npm run test:calibration  # Golden set regression (102 examples)
```

### Adding Tests

- **Unit tests:** `tests/unit/` — Test individual functions
- **Integration tests:** `tests/integration/` — Test pipeline end-to-end
- **Golden set:** `tests/eval/golden-set.ts` — Add examples for regression

### Golden Set Rules

- Every example must have a known correct outcome
- Examples must cover edge cases (overtime, fringe, classification)
- Run `npm run test:calibration` before submitting

---

## Code Style

- **TypeScript strict mode** — No `any` without explicit justification
- **Zod schemas** — All external inputs validated at runtime
- **Pino logging** — Structured JSON, never `console.log`
- **Async/await** — No callback hell
- **ESM** — No CommonJS

---

## Pull Request Process

1. **Fork and branch** — `feature/description` or `fix/description`
2. **Add tests** — Every change needs test coverage
3. **Run full suite** — `npm test` must pass
4. **Update docs** — If you change behavior, update the relevant doc
5. **Open PR** — Describe what changed and why
6. **Wait for CI** — GitHub Actions runs build + test + coverage + lint

---

## Questions?

- [FAQ](../docs/faq.md) — Common questions
- [Architecture](../docs/architecture/system-overview.md) — How the system works
- [API Reference](../docs/api-reference.md) — Endpoint documentation

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](../LICENSE).

---

*Last updated: 2026-04-22*
