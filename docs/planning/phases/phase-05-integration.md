# Phase 5 — Integration + The Demo

> **Historical planning document.** Docker references below are from the original design; the project now uses WSL-native infrastructure only.

**Goal:** Full stack runs end-to-end. Real PDF upload completes in <2s with Phoenix trace, regulation citations, trust score. CI is green. Golden set passes. Project is deployable.

---

## Exit Criteria (Hard Gate)

```bash
# Full stack
docker-compose up --build -d  # all services healthy within 60 seconds

# E2E smoke test
curl -X POST http://localhost:3000/api/analyze-pdf \
  -F "file=@tests/fixtures/sample-wh347.pdf" \
  | jq '.trust_score, .verdict, .phoenix_trace_id'
# All three fields populated, trust_score > 0

# Eval regression
cd backend && poetry run pytest tests/eval/ --benchmark-only
cd backend && poetry run python tests/eval/regression_test.py  # 0 regressions

# CI (local simulation):
# Python: poetry run pytest tests/unit tests/integration -v
# Agent: cd agent && npm test
# Frontend: cd frontend && npm run build && npm run typecheck
```

**Do not proceed to Phase 6 until CI is green and eval passes.**

---

## Goals

1. Verify and fix Docker Compose
2. Write E2E integration test
3. Expand golden set to 100 examples
4. Implement regression detector
5. Write GitHub Actions workflows
6. Write ADRs
7. Rewrite README
8. Deploy

---

## Task Breakdown

### 5.1 — Verify and Fix Docker Compose

**Destination:** `docker-compose.yml`

Add health checks to all services:

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U wcp"]
      interval: 5s
      timeout: 5s
      retries: 5
    
  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    
  elasticsearch:
    image: elasticsearch:8.15.0
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:9200/_cluster/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    
  phoenix:
    image: arizephoenix/phoenix:latest
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6006"]
      interval: 5s
      timeout: 3s
      retries: 10
    
  backend:
    build: ./backend
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 10s
      timeout: 5s
      retries: 5
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      elasticsearch:
        condition: service_healthy
      phoenix:
        condition: service_healthy
    
  agent:
    build: ./agent
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 10s
      timeout: 5s
      retries: 5
    depends_on:
      backend:
        condition: service_healthy
    
  frontend:
    build: ./frontend
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5173"]
      interval: 10s
      timeout: 5s
      retries: 5
    depends_on:
      agent:
        condition: service_healthy
```

Add `restart: unless-stopped` to all services.

Test the full stack:
```bash
docker-compose down -v  # clean slate
docker-compose up --build -d
# Wait 60 seconds, then:
docker-compose ps  # all services should show "healthy"
```

---

### 5.2 — E2E Integration Test

**Option A (Python, CI-friendly):** `backend/tests/integration/test_e2e_pipeline.py`

```python
import pytest
import httpx

@pytest.mark.asyncio
async def test_full_pipeline_text():
    """End-to-end test: text input → decision with Phoenix trace."""
    async with httpx.AsyncClient() as client:
        # Submit analysis
        response = await client.post(
            "http://localhost:3000/api/analyze",
            json={"text": "Role: Electrician, Hours: 40, Wage: 51.69, Fringe: 34.63"}
        )
        response.raise_for_status()
        decision = response.json()
        
        # Validate response structure
        assert "jobId" in decision
        assert "trustScore" in decision
        assert "verdict" in decision
        assert decision["verdict"] in ["APPROVED", "REJECTED", "REVISE"]
        assert 0 <= decision["trustScore"] <= 1
        assert decision["phoenixTraceId"] != ""
        
        # Verify persistence
        job_id = decision["jobId"]
        get_response = await client.get(f"http://localhost:8000/decisions/{job_id}")
        get_response.raise_for_status()
        persisted = get_response.json()
        assert persisted["jobId"] == job_id

@pytest.mark.asyncio
async def test_full_pipeline_pdf():
    """End-to-end test: PDF upload → decision."""
    async with httpx.AsyncClient() as client:
        with open("tests/fixtures/sample-wh347.pdf", "rb") as f:
            response = await client.post(
                "http://localhost:3000/api/analyze-pdf",
                files={"file": ("test.pdf", f, "application/pdf")}
            )
        response.raise_for_status()
        decision = response.json()
        assert decision["trustScore"] > 0
```

**Create test fixture:** Copy a real WH-347 PDF to `backend/tests/fixtures/sample-wh347.pdf` or use a minimal generated PDF for CI.

---

### 5.3 — Expand Golden Set to 100 Examples

**Destination:** `backend/tests/eval/golden_set.json`

Structure:
```json
[
  {
    "id": "eval_001",
    "description": "Compliant electrician",
    "input": {
      "tradeClassification": "Electrician",
      "hoursWorked": 40,
      "hourlyWage": 51.69,
      "fringeBenefits": 34.63,
      "overtimeHours": 0,
      "locality": "Washington, DC"
    },
    "expectedVerdict": "approved",
    "expectedChecksPassed": ["wage_check", "fringe_check", "overtime_check", "total_check"],
    "minimumTrustScore": 0.85,
    "regulations": ["40 U.S.C. § 3142", "40 U.S.C. § 3141(2)(B)"]
  }
]
```

Distribution:
- 40 approved cases (clean compliance)
- 30 wage violation cases
- 15 fringe violation cases
- 10 overtime violation cases
- 5 multi-violation edge cases

Port remaining examples from `_archive/tests/eval/golden-set.ts`.

---

### 5.4 — Regression Detector

**Destination:** `backend/tests/eval/regression_test.py`

```python
#!/usr/bin/env python3
"""Compare current eval results against baseline. Hard-fail on drift."""

import json
import sys
from pathlib import Path

BASELINE_PATH = Path(__file__).parent / "baseline.json"
CURRENT_PATH = Path(__file__).parent / "current_results.json"

def load_results(path: Path) -> dict:
    with open(path) as f:
        return json.load(f)

def main():
    if not BASELINE_PATH.exists():
        print("No baseline found. Creating from current results.")
        current = load_results(CURRENT_PATH)
        with open(BASELINE_PATH, "w") as f:
            json.dump(current, f, indent=2)
        return 0
    
    baseline = load_results(BASELINE_PATH)
    current = load_results(CURRENT_PATH)
    
    errors = []
    
    for example_id, baseline_result in baseline.items():
        current_result = current.get(example_id)
        if not current_result:
            errors.append(f"{example_id}: missing in current results")
            continue
        
        # Check trust score drift
        baseline_score = baseline_result["trustScore"]
        current_score = current_result["trustScore"]
        drift = abs(baseline_score - current_score)
        
        if drift > 0.05:
            errors.append(
                f"{example_id}: trust score drift {drift:.3f} "
                f"(baseline: {baseline_score:.3f}, current: {current_score:.3f})"
            )
        
        # Check verdict accuracy
        if baseline_result["verdict"] != current_result["verdict"]:
            errors.append(
                f"{example_id}: verdict changed from {baseline_result['verdict']} "
                f"to {current_result['verdict']}"
            )
    
    # Check overall accuracy
    baseline_accuracy = sum(1 for r in baseline.values() if r["correct"]) / len(baseline)
    current_accuracy = sum(1 for r in current.values() if r["correct"]) / len(current)
    
    if current_accuracy < 0.95:
        errors.append(f"Accuracy below 95%: {current_accuracy:.2%}")
    
    if current_accuracy < baseline_accuracy - 0.02:
        errors.append(
            f"Accuracy regression: {baseline_accuracy:.2%} → {current_accuracy:.2%}"
        )
    
    if errors:
        print("REGRESSION DETECTED:")
        for err in errors:
            print(f"  - {err}")
        return 1
    
    print(f"All checks passed. Accuracy: {current_accuracy:.2%}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

---

### 5.5 — GitHub Actions Workflows

**Destination:** `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: wcp
          POSTGRES_PASSWORD: wcp
          POSTGRES_DB: wcp
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      
      - name: Install Poetry
        uses: snok/install-poetry@v1
      
      - name: Install dependencies
        working-directory: ./backend
        run: poetry install
      
      - name: Run migrations
        working-directory: ./backend
        run: poetry run alembic upgrade head
        env:
          DATABASE_URL: postgresql+asyncpg://wcp:wcp@localhost:5432/wcp
          REDIS_URL: redis://localhost:6379
      
      - name: Run unit tests
        working-directory: ./backend
        run: poetry run pytest tests/unit -v
      
      - name: Run integration tests
        working-directory: ./backend
        run: poetry run pytest tests/integration -v
        env:
          DATABASE_URL: postgresql+asyncpg://wcp:wcp@localhost:5432/wcp
          REDIS_URL: redis://localhost:6379

  agent:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: ./agent/package-lock.json
      
      - name: Install dependencies
        working-directory: ./agent
        run: npm ci
      
      - name: Type check
        working-directory: ./agent
        run: npm run typecheck
      
      - name: Run tests
        working-directory: ./agent
        run: npm test

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: ./frontend/package-lock.json
      
      - name: Install dependencies
        working-directory: ./frontend
        run: npm ci
      
      - name: Type check
        working-directory: ./frontend
        run: npm run typecheck
      
      - name: Build
        working-directory: ./frontend
        run: npm run build
```

**`.github/workflows/eval.yml`:**

```yaml
name: Evaluation

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 6 * * *'  # Daily at 6 AM UTC

jobs:
  evaluate:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: wcp
          POSTGRES_PASSWORD: wcp
          POSTGRES_DB: wcp
        ports:
          - 5432:5432
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
      elasticsearch:
        image: elasticsearch:8.15.0
        env:
          discovery.type: single-node
          xpack.security.enabled: "false"
        ports:
          - 9200:9200
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      
      - name: Install Poetry
        uses: snok/install-poetry@v1
      
      - name: Install dependencies
        working-directory: ./backend
        run: poetry install
      
      - name: Run migrations
        working-directory: ./backend
        run: poetry run alembic upgrade head
      
      - name: Seed data
        working-directory: ./backend
        run: |
          poetry run python scripts/seed_dbwd.py
          poetry run python scripts/seed_elasticsearch.py
      
      - name: Run golden set
        working-directory: ./backend
        run: poetry run pytest tests/eval/ --benchmark-only -v
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
      
      - name: Regression test
        working-directory: ./backend
        run: poetry run python tests/eval/regression_test.py
      
      - name: Upload eval artifact
        uses: actions/upload-artifact@v4
        with:
          name: eval-results
          path: backend/tests/eval/current_results.json
```

**`.github/workflows/deploy.yml`:**

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: ./frontend

  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Render Deploy
        run: |
          curl -X POST ${{ secrets.RENDER_BACKEND_DEPLOY_HOOK }}

  deploy-agent:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Render Deploy
        run: |
          curl -X POST ${{ secrets.RENDER_AGENT_DEPLOY_HOOK }}
```

---

### 5.6 — Write ADRs

**Destination:** `docs/adrs/`

Create all 9 ADRs:

| ADR | File | One-Sentence Summary |
|---|---|---|
| ADR-001 | `001-three-layers.md` | Three-layer architecture (deterministic → LLM → trust) ensures federal compliance decisions are explainable and auditable. |
| ADR-002 | `002-python-typescript-split.md` | Python for deterministic validation (math exactness), TypeScript for agent orchestration (I/O concurrency), React for UI. |
| ADR-003 | `003-mastra.md` | Mastra.ai provides structured output, tool-use, and tracing out of the box; custom orchestrator would add maintenance burden. |
| ADR-004 | `004-phoenix.md` | Phoenix/Arize offers open-source LLM tracing with minimal setup; integrates with OpenTelemetry for cross-service spans. |
| ADR-005 | `005-langfuse.md` | Langfuse provides prompt versioning, A/B testing, and cost tracking with a hosted option; self-hostable if needed. |
| ADR-006 | `006-hybrid-rag.md` | BM25 (exact match) + vector (semantic) + cross-encoder (precision) gives best retrieval quality for regulation lookup. |
| ADR-007 | `007-pgvector.md` | Single PostgreSQL instance for relational + vector data reduces operational complexity; acceptable performance for <10k chunks. |
| ADR-008 | `008-celery-redis.md` | Celery + Redis provides persistent, recoverable job queue; in-memory queues lose state on restart. |
| ADR-009 | `009-react.md` | React 19 + Vite + Tailwind + Shadcn is industry-standard with strong TypeScript support and component ecosystem. |

Each ADR follows the format:
```markdown
# ADR-XXX: Title

## Status
Accepted

## Context
What is the issue we're deciding?

## Decision
What did we decide?

## Consequences
Positive and negative consequences of this decision.

## Alternatives Considered
What else did we consider and why did we reject it?
```

---

### 5.7 — Rewrite README

**Destination:** `README.md`

Structure:
```markdown
# WCP Compliance Agent v3

AI-powered Davis-Bacon Act compliance checking for federal contractors.

## Architecture

Three-service polyglot architecture:
- **Backend** (Python): Deterministic validation, rule engine, data layer
- **Agent** (TypeScript): LLM orchestration, prompt management, observability  
- **Frontend** (React): Product UI for upload, review, and analytics

## Quick Start

```bash
# Clone and start everything
git clone <repo>
cd wcp-compliance-agent
docker-compose up --build

# Open http://localhost:5173
```

## Development

See [docs/local-dev.md](docs/local-dev.md) for detailed setup.

## Architecture

See [docs/planning/V3_PLAN.md](docs/planning/V3_PLAN.md) for full architecture documentation.

## ADRs

See [docs/adrs/](docs/adrs/) for architecture decision records.

## Compliance

This system implements Davis-Bacon Act (40 U.S.C. § 3142) and CFR 29 Part 5 wage determination checks.

## License

MIT
```

---

### 5.8 — Deploy

**Vercel (Frontend):**
1. Connect GitHub repo to Vercel
2. Set root directory to `frontend/`
3. Add environment variable: `VITE_API_URL=https://wcp-agent-api.render.com`
4. Deploy

**Render (Backend + Agent):**
1. Create two web services on Render
2. Backend: Build from `backend/Dockerfile`, set `DATABASE_URL`, `REDIS_URL`, `OPENAI_API_KEY`
3. Agent: Build from `agent/Dockerfile`, set `BACKEND_URL`, `OPENAI_API_KEY`
4. Add deploy hooks to GitHub Actions secrets

Verify:
```bash
curl https://wcp-agent-api.render.com/health
curl https://wcp-agent.render.com/health
```

---

## Architecture Notes

### Docker Compose Is The Integration Harness
All services run identically in Docker and in CI. No "it works on my machine" issues.

### Golden Set Is A Regression Gate, Not A Benchmark
It does not measure performance — it measures that the pipeline hasn't broken. Run it on every push to main.

### ADRs Are Written After Implementation
They document decisions that were made, with evidence from the actual build. They are not speculative.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Docker Compose networking breaks | Medium | High | Test service-to-service calls inside Docker before CI. Use `docker-compose exec` to debug. |
| Golden set accuracy below 95% | Medium | High | Triage by failure mode. Likely causes: DBWD rates not seeded, trust score weights wrong. |
| Render cold start adds >5s | High | Medium | Keep agents warm with scheduled health-check ping. Document in README. |
| Vercel CORS to Render | Medium | Medium | Update `cors()` in `agent/src/server.ts` with Vercel production domain. |

---

## Command Reference

```bash
# Full stack
docker-compose up --build -d

# Check health
docker-compose ps

# View logs
docker-compose logs -f backend

# E2E test
curl -X POST http://localhost:3000/api/analyze \
  -d '{"text": "Role: Electrician, Hours: 40, Wage: 51.69"}'

# Eval
cd backend && poetry run pytest tests/eval/ --benchmark-only
```

---

*Phase 5 document version: 2026-04-22*
*Blocked by: Phase 4 frontend build succeeding*
