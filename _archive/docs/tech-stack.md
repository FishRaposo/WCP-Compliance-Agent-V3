# Tech Stack

## Runtime and Language

| Component | Technology | Version | Rationale |
|---|---|---|---|
| Runtime | Node.js | 22+ | LTS with native ESM, built-in test runner, performance improvements |
| Language | TypeScript | 5.7+ | Strict typing with Zod schema inference, ESM output |

## API Layer

| Component | Technology | Rationale |
|---|---|---|
| HTTP Framework | [Hono](https://hono.dev/) | Lightweight, fast, TypeScript-native, middleware composition |
| Validation | [Zod](https://zod.dev/) | Runtime schema validation with TypeScript inference |
| Rate Limiting | Custom middleware | Token bucket, 60 req/min per IP |
| CORS | Hono built-in | Configurable allowed origins |

## AI and LLM

| Component | Technology | Rationale |
|---|---|---|
| LLM Provider | OpenAI (via Vercel AI SDK v4) | gpt-4o-mini for cost-effective reasoning |
| Embeddings | OpenAI text-embedding-3-small | 1536 dimensions, cost-optimized |
| Structured Output | Zod schemas | Constrained generation with type safety |
| Prompt Versioning | File-based registry | Simple, auditable, git-tracked |

## Data and Storage

| Component | Technology | Rationale |
|---|---|---|
| Primary Storage | In-memory / PostgreSQL | Zero-config default; PostgreSQL for persistence |
| Vector Search | pgvector (PostgreSQL extension) | Native Postgres integration, no separate service |
| Text Search | Elasticsearch (optional) | BM25 for Phase 02 hybrid retrieval |
| Cache | Redis (optional) | Job queue, session cache |
| Migrations | SQL files | Version-controlled schema, no ORM magic |

## Frontend

| Component | Technology | Rationale |
|---|---|---|
| Framework | React 19 | Concurrent features, automatic batching |
| Build Tool | Vite | Fast HMR, optimized production builds |
| Styling | TailwindCSS | Utility-first, design system consistency |
| Components | Shadcn/ui | Accessible, customizable primitives |

## Testing and Quality

| Component | Technology | Rationale |
|---|---|---|
| Test Framework | Vitest | Vite-native, fast, ESM support |
| Coverage | v8 provider | Native integration, accurate reporting |
| E2E | Playwright | Real browser testing, traceable failures |
| Architecture Lint | ts-morph | AST-based pipeline boundary enforcement |
| Golden Set | Custom (102 examples) | Regression detection and trust calibration |

## Logging and Observability

| Component | Technology | Rationale |
|---|---|---|
| Logger | Pino | Structured JSON, minimal overhead |
| Tracing | OpenTelemetry (Phase 02) | Standardized observability |
| LLM Tracing | Phoenix (Phase 02) | Prompt versioning, cost tracking, A/B testing |

## Deployment

| Component | Technology | Rationale |
|---|---|---|
| Hosting | Vercel | Serverless functions, edge deployment |
| CI/CD | GitHub Actions | Automated testing, linting, coverage gates |
| Infrastructure | Docker Compose (v3) | One-command full stack for local development |

---

## Technology Exclusions (Intentional)

These technologies were considered but excluded to maintain focus:

| Technology | Why Excluded |
|---|---|
| ORM (Prisma/TypeORM) | Raw SQL migrations preferred for auditability |
| GraphQL | REST sufficient for single-domain API |
| tRPC | Not needed for external API surface |
| NestJS | Too heavy for focused compliance tool |
| Next.js | SPA adequate; no SSR requirements |
| LangChain | Abstraction too heavy; Vercel AI SDK sufficient |

---

*Last updated: 2026-04-22*
