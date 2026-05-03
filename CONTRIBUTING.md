# Contributing

This is a portfolio project maintained by a single developer. Issues, questions, and discussions are welcome. Pull requests are accepted by arrangement — please open an issue first to discuss what you'd like to change.

## Getting Started

See [AGENTS.md](AGENTS.md) for all build, test, lint, and dev commands. Each service is independent — always `cd` into the service directory before running commands.

### Prerequisites

- Python 3.12+
- Node.js 20+
- PostgreSQL 16 (with pgvector)
- Redis 7
- Elasticsearch 8

### Quick Setup

```bash
# Clone
git clone https://github.com/FishRaposo/WCP-Compliance-Agent-V3.git
cd WCP-Compliance-Agent-V3

# Backend
cd backend && poetry install
# To include V4 data-platform extras (DuckDB, Prefect, PyArrow, Great Expectations):
cd backend && poetry install -E v4

# Agent
cd agent && npm ci

# Frontend
cd frontend && npm ci
```

### Mock Mode (no infrastructure needed)

```bash
# Frontend only — all API calls return fixture data
cd frontend && VITE_MOCK_API=true npm run dev

# Agent only — deterministic mock verdicts
cd agent && LLM_MODE=mock npm run dev
```

## Code Style

| Service | Linter | Config |
|---|---|---|
| **Backend** | ruff (line-length 100) + mypy (strict) | `pyproject.toml` |
| **Agent** | eslint + TypeScript strict | `eslint.config.js`, `tsconfig.json` |
| **Frontend** | eslint + TypeScript strict | `eslint.config.js`, `tsconfig.json` |

Prettier is **not** used in this project.

## Testing

All three service checks must pass before submitting changes:

```bash
# Backend
cd backend && poetry run pytest tests/unit -v

# Agent
cd agent && npm run typecheck && npm test

# Frontend
cd frontend && npm run typecheck && npm run build
```

See [AGENTS.md](AGENTS.md) for integration tests, eval tests, and additional commands.

## Architecture

Before making changes, review:

- [Architecture Overview](docs/architecture.md) — system design and service boundaries
- [ADRs](docs/adrs/) — why specific technologies were chosen
- [API Contract](docs/api-contract.md) — REST API specification

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(agent): add retry logic to LLM router
fix(backend): correct overtime calculation for double-time
docs: update evaluation pipeline documentation
chore: update dependencies
```

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
