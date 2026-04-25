# Changelog

All notable changes to WCP Compliance Agent.

---

## [2.0.0] — 2026-04-22

### Release — V2 Reference Implementation

**V2 is a ground-up rewrite** of the V1 Mastra.ai prototype as a self-contained TypeScript/Node.js application.

### Added
- **Three-layer decision pipeline** with AST-enforced boundaries
  - Layer 1: Deterministic extraction + DBWD rate lookup + rule checks
  - Layer 2: Constrained LLM reasoning with regulation citations
  - Layer 3: Trust scoring with auto/flag/human routing bands
- **310 tests** — unit, integration, calibration, e2e
- **102-example golden set** for regression detection and trust calibration
- **Full audit trail** — timestamped record of every pipeline step
- **Trust scoring** — four-component score with configurable bands
- **Human review queue** — in-memory with priority routing
- **Prompt versioning** — file-based registry with v2 template + org overrides
- **Document ingestion** — PDF + CSV multipart upload
- **Configurable DBWD corpus** — 20 trades, JSON-configurable
- **Rate limiting** — 60 req/min per IP
- **Mock mode** — full offline development without OpenAI API
- **CI pipeline** — GitHub Actions with 80% coverage gate
- **React 19 frontend** — Vite + Tailwind demo UI
- **CHANGELOG.md** — release history and version notes
- **Product roadmap** — 5 phases (scaffolding → MVP → showcase → post-launch)
- Unit tests for `generateMockWcpDecision` and `isMockMode`
- `llms.txt` — AI crawler navigation
- `docs/faq.md` — 12-question FAQ for SEO/GEO visibility
- `docs/comparison.md` — vs manual, generic payroll, other AI tools
- `docs/api-reference.md` — full API documentation
- `docs/tech-stack.md` — technology choices and rationale
- `CONTRIBUTING.md` — developer setup and architecture rules

### Fixed
- **Logging consistency**: Replaced all `console.log` / `console.warn` calls with structured pino logger
- **Type safety**: Removed unsafe `as` assertions
- **Security**: Fixed API key restoration after requests (try/finally), preventing key leakage
- **Security**: Added input size limits to CSV and Vercel endpoints
- **Security**: Added `instanceof File` validation in multipart uploads
- **Security**: Replaced wildcard CORS with origin validation
- **Code quality**: `generateTraceId()` now uses `crypto.randomUUID()`
- **Code quality**: Fixed deprecated `.substr()` to `.slice()`
- **Code quality**: Added `Number.isFinite()` guards around `parseFloat()`
- **Code quality**: Added error logging to previously silent `catch` blocks
- **API robustness**: Added missing try/catch to `/api/decisions` and `/api/jobs/:jobId`
- **API robustness**: Added `NaN` handling for `limit` query parameter
- **Tests**: Fixed runtime type errors in test data files
- **Tests**: Fixed `process.env` isolation bugs
- **Tests**: Replaced tautology assertions with real assertions
- **Docs**: Removed broken internal links across documentation
- **Build**: `package.json` `clean` script uses ESM-compatible `import('fs')`

### Security
- Added input length validation to `/analyze` endpoint to prevent potential DoS attacks.
- Added configurable `maxContentLength` (default 10,000 chars) to `ApiConfig`.
- Added `secureHeaders()` middleware for XSS, clickjacking, and MIME-sniffing protection.
- Removed stack traces from serialized error responses.

### Changed
- Removed personal IDE configs (`.claude/`, `.agents/skills/`) from repository
- Updated `.gitignore` to exclude IDE configs, test results, playwright reports
- Updated `docs/roadmap/RELEASE_PLAN.md` to mark Phase 03 as complete
- README rewritten with SEO-optimized H1, human tagline, "By the Numbers" section
- `package.json` description updated with domain keywords (davis-bacon, prevailing-wage, etc.)

---

## [1.0.0] — 2024-04

### Prototype — V1 Mastra.ai

**V1 validated the concept.** Built on Mastra.ai 0.24.x with two tools (`extractWCPTool`, `validateWCPTool`).

### What worked
- Hybrid deterministic + LLM concept proved viable
- 197 tests (169 passing, 28 server-dependent skipped)
- Basic DBWD rate validation against 2 hard-coded trades

### What didn't
- Monolithic agent architecture — no clean pipeline separation
- No structured audit trail
- No trust scoring or human-review routing
- No prompt versioning
- No document ingestion beyond raw text
- No CI pipeline or architectural enforcement
- No mock mode for offline development

**V1 was archived and rewritten from scratch for V2.**

---

## V3 — Planned

**V3 restructures into a production-grade polyglot architecture:**

- **Python backend** (FastAPI): deterministic Layer 1, DBWD ETL pipelines, persistent audit store
- **TypeScript agent** (Mastra.ai): Layer 2 LLM reasoning, orchestration
- **React 19 frontend**: multi-employee UI, cost tracking, review queue
- **Infrastructure**: Docker Compose with PostgreSQL + pgvector + Redis + Elasticsearch
- **Observability**: Phoenix LLM tracing + OpenTelemetry

See [docs/v3/V3_PLAN.md](docs/v3/V3_PLAN.md) for the full technical plan.

---

[2.0.0]: https://github.com/FishRaposo/WCP-Compliance-Agent/releases/tag/v2.0.0
[1.0.0]: https://github.com/FishRaposo/WCP-Compliance-Agent/releases/tag/v1.0.0
