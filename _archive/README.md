# WCP Compliance Agent — Davis-Bacon Act Payroll Validation

[![CI](https://github.com/FishRaposo/WCP-Compliance-Agent/actions/workflows/pipeline-discipline.yml/badge.svg)](https://github.com/FishRaposo/WCP-Compliance-Agent/actions/workflows/pipeline-discipline.yml)
[![Coverage](https://img.shields.io/badge/coverage-83%2B-brightgreen)](#running-tests)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-green)](https://nodejs.org/)

> **Payroll decisions you can defend in court.**  
> Three rounds of proof. Every finding cites the law. Every decision has a paper trail.

**[→ Live Demo](https://wcp-compliance-agent.vercel.app)** · **[→ Quick Start](./docs/quick-start.md)** · **[→ FAQ](./docs/faq.md)**

---

## What It Does

WCP (Weekly Certified Payroll) Compliance Agent validates [Davis-Bacon Act](https://www.dol.gov/agencies/whd/government-contracts/construction) federal construction payroll submissions against U.S. Department of Labor prevailing wage requirements.

It answers four questions that determine if a contractor is compliant:

- **Are workers paid the legal minimum?** — Checks base wage against prevailing wage determinations
- **Is overtime calculated correctly?** — Validates 1.5× rate for hours over 40 per week
- **Are fringe benefits sufficient?** — Verifies supplemental benefits meet locality requirements
- **Is the classification correct?** — Confirms worker role matches the job type

Every decision goes through three layers of proof:

1. **Check the facts** — Extract role, hours, wage from payroll text. Verify against federal prevailing wage rates. No LLM. Pure arithmetic and policy rules.
2. **Get a second opinion** — AI reviews the findings. Must cite the specific statute. Cannot change the math.
3. **Route with confidence** — High confidence? Approve. Medium? Flag for review. Low? Human decides.

---

## By the Numbers

- **310 tests** covering unit, integration, calibration, and end-to-end scenarios
- **83%+ code coverage** with 80% CI gate
- **102-example golden set** for regression detection and trust calibration
- **20 construction trades** in the default prevailing wage corpus
- **3 layers** of decision proof with full audit trail
- **60 requests/min** rate limiting per IP
- **7-year** audit trail retention design
- **0 external dependencies** for core functionality (mock mode)

---

## Quick Start

```bash
git clone https://github.com/FishRaposo/WCP-Compliance-Agent.git
cd WCP-Compliance-Agent && npm install
OPENAI_API_KEY=mock npm run serve
```

Server runs at `http://localhost:3000`. See [Quick Start](docs/quick-start.md) for full setup including PDF/CSV upload and configuration.

---

## One Endpoint. Three Layers of Proof.

### `POST /api/analyze`

Submit payroll text. Get a compliance decision with full audit trail.

**Request**
```json
{ "content": "Role: Electrician, Hours: 40, Wage: 51.69, Fringe: 34.63" }
```

**Response** (abbreviated)
```json
{
  "finalStatus": "Approved",
  "deterministic": {
    "role": "Electrician",
    "hours": 40,
    "wage": 51.69,
    "checks": [
      { "id": "wage_check_001", "type": "base_wage", "status": "pass",
        "regulation": "40 U.S.C. § 3142", "message": "Wage meets prevailing rate" }
    ],
    "score": 1.0
  },
  "verdict": {
    "status": "Approved",
    "rationale": "All checks pass. Wage meets prevailing rate.",
    "referencedCheckIds": ["wage_check_001"],
    "citations": ["40 U.S.C. § 3142", "29 CFR 5.5(a)(1)"]
  },
  "trust": { "score": 0.92, "band": "auto" },
  "humanReview": { "required": false },
  "auditTrail": [...],
  "traceId": "abc-123"
}
```

See [API Reference](docs/api-reference.md) for PDF/CSV upload, async jobs, and all endpoints.

---

## Running Tests

```bash
npm test                  # Full suite: build + 310 tests
npm run test:unit         # 297 unit + integration tests
npm run test:pipeline     # Pipeline-specific tests
npm run test:coverage     # Coverage report (≥80% gate)
npm run test:calibration  # 102-example golden set
npm run test:retrieval    # Hybrid retriever tests
npm run lint:pipeline     # AST architectural lint
npm run build             # TypeScript + Vite compilation
```

**Mock mode** (no API key required): set `OPENAI_API_KEY=mock` — all tests pass without calling OpenAI.

---

## Documentation

### For developers
- [Quick Start](docs/quick-start.md) — 5 minutes to running locally
- [Architecture](docs/architecture/system-overview.md) — How the three layers work
- [API Reference](docs/api-reference.md) — All endpoints and request formats
- [Tech Stack](docs/tech-stack.md) — Technology choices and rationale

### For compliance officers
- [Regulatory Report](docs/compliance/regulatory-compliance-report.md) — How we enforce Davis-Bacon Act requirements
- [Traceability Matrix](docs/compliance/traceability-matrix.md) — Every regulation mapped to code
- [FAQ](docs/faq.md) — Common questions about compliance, AI decisions, and trust scoring

### For evaluators and hiring managers
- [V2 Inventory Report](docs/development/V2_INVENTORY_REPORT.md) — Full code audit and readiness assessment
- [V2 Roadmap Audit](docs/development/V2_ROADMAP_AUDIT.md) — What was built vs. what was planned
- [V3 Plan](docs/v3/V3_PLAN.md) — Production architecture (Python + TypeScript + React)

### Project history
- [CHANGELOG](CHANGELOG.md) — Release history and version notes
- [ADRs](docs/adrs/) — Architecture Decision Records
- [CONTRIBUTING](CONTRIBUTING.md) — How to contribute

---

## About the Author

Built by **[Vinícius Raposo](https://github.com/FishRaposo)** — systems engineer focused on AI infrastructure for regulated industries. This project demonstrates how to build AI systems where every decision is explainable, traceable, and defensible.

**Related work:**
- [Portfolio and professional background](https://github.com/FishRaposo) (GitHub)
- [Career documentation hub](https://github.com/FishRaposo/career-hub) — job descriptions, platform bios, recruiting materials

---

## License

[MIT](./LICENSE) © 2026 Vinícius Raposo

*Last updated: 2026-04-22*  
*GitHub Topics: `davis-bacon-act`, `prevailing-wage`, `federal-compliance`, `payroll-validation`, `construction-compliance`, `wh-347`, `wage-determination`, `ai-compliance`, `automated-audit`, `trust-scoring`*
