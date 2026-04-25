# FAQ — WCP Compliance Agent

**Last updated: 2026-04-22**

---

## What is WCP?

**WCP** stands for **Weekly Certified Payroll** — a federal form (WH-347) that construction contractors must submit to prove they're paying workers the legally required prevailing wage on government-funded projects.

The Davis-Bacon Act (1931) requires that workers on federal construction contracts be paid at least the local prevailing wage — including fringe benefits — for their trade.

---

## What is the Davis-Bacon Act?

The [Davis-Bacon Act](https://www.dol.gov/agencies/whd/government-contracts/construction) (40 U.S.C. §§ 3141-3144) requires contractors on federally funded construction projects to pay workers no less than the locally prevailing wage for their trade.

Key requirements:
- **Base wage** must meet or exceed the prevailing rate for the trade and locality
- **Overtime** at 1.5× the base rate for hours over 40 per week
- **Fringe benefits** must be provided in addition to the base wage, or paid as cash equivalents
- **Worker classification** must accurately reflect the work performed (e.g., Electrician vs. Laborer)

Violations can result in contract termination, payment withholding, fines, and debarment from future federal contracts.

---

## How does WCP Compliance Agent verify compliance?

Through three layers of proof:

1. **Deterministic extraction and validation** — Extracts role, hours, wage, and fringe from payroll text. Verifies against Department of Labor prevailing wage determinations using arithmetic and policy rules. No AI. No guessing.

2. **AI reasoning over findings** — An LLM reviews the deterministic results, confirms the regulatory interpretation, and cites the specific statutes (40 U.S.C. § 3142, 29 CFR 5.5, etc.). The LLM **cannot** change the math — it only validates the reasoning.

3. **Trust scoring and routing** — A weighted confidence score determines if the decision is approved automatically, flagged for review, or routed to a human.

Every layer produces timestamped evidence. Every decision has a full audit trail.

---

## What does "prevailing wage" mean?

The prevailing wage is the average wage paid to workers in a specific trade (e.g., Electrician, Plumber) in a specific locality (e.g., New York City, rural Texas). The Department of Labor publishes these rates in **Wage Determinations** that contractors must follow.

For example:
- Electrician in San Francisco: $52.50/hour base + $18.75/hour fringe
- Laborer in rural Oklahoma: $15.30/hour base + $4.20/hour fringe

WCP Compliance Agent validates that every worker's pay meets or exceeds the prevailing rate for their trade and location.

---

## Can the AI change the payroll numbers?

**No.** This is a core design constraint. The LLM (Layer 2) is explicitly forbidden from recomputing or modifying any values extracted by Layer 1. It can only:

- Confirm or challenge the interpretation of findings
- Cite the relevant regulations
- Explain the compliance status

All arithmetic — wage checks, overtime calculations, fringe validations — happens in deterministic Layer 1 code that is fully auditable and testable.

---

## What is a "trust score"?

The trust score (0.0–1.0) is a weighted confidence metric that routes decisions:

| Score | Band | Action |
|---|---|---|
| ≥ 0.75 | **Auto** | Approve without human review |
| 0.60–0.74 | **Flag** | Approve but log for periodic audit |
| < 0.60 | **Human** | Route to human reviewer |

The score combines:
- Deterministic check results (pass/fail weight)
- LLM confidence (how certain the AI is)
- Data completeness (were all fields extractable?)
- Regulation specificity (how precise were the citations?)

---

## What happens if the system makes a mistake?

Every decision includes:
- **Full audit trail** — Every step, every check, every citation, timestamped
- **Trace ID** — A unique identifier for appeals or investigation
- **Human review queue** — Low-confidence decisions are automatically routed to humans
- **Golden set regression** — 102 historical examples are re-tested on every code change to catch regressions

If a decision is wrong, you can trace exactly which layer failed and why. The system is designed for **accountability**, not just automation.

---

## Does this replace human compliance officers?

**No.** It augments them.

The system handles the repetitive work — extraction, arithmetic, initial classification — so humans can focus on:

- Edge cases and ambiguous classifications
- Appeals and disputes
- Policy interpretation
- Relationship management with contractors

High-confidence decisions are auto-approved. Medium and low-confidence decisions are flagged for human review. The system is a **filter**, not a replacement.

---

## What is a "golden set"?

The golden set is a collection of **102 representative payroll examples** with known compliance outcomes. It's used to:

- **Calibrate trust scores** — Ensure the routing bands (auto/flag/human) match real-world distributions
- **Detect regressions** — Re-test all examples on every code change
- **Validate the pipeline** — Confirm that changes don't break existing behavior

Think of it as a "unit test for business logic" — realistic scenarios that must continue to produce correct results.

---

## Is this production-ready?

**V2 (current) is a reference implementation.** It compiles cleanly, passes 310 tests, has 83%+ coverage, and the core pipeline works end-to-end. However, some components are intentionally stubbed for demonstration:

- Hybrid retrieval (BM25 + vector) is structured but not connected to live Elasticsearch
- Human review queue is in-memory only (no persistence)
- Live DBWD rate updates require ETL pipeline from DOL/SAM.gov

**V3 (planned)** restructures this into a production-grade multi-service architecture with Python backend, persistent storage, and full observability. See [V3 Plan](../v3/V3_PLAN.md).

---

## What do I need to run this?

**Minimum:**
- Node.js 22+
- `OPENAI_API_KEY=mock` (no real API key needed for testing)

**Optional for persistence:**
- PostgreSQL 16+ (for audit storage)
- Redis (for job queue)
- Elasticsearch (for hybrid retrieval)

See [Quick Start](../quick-start.md) for full setup.

---

## How much does it cost to run?

**Development and testing:** Free. Mock mode works without any API calls.

**Production (with OpenAI):**
- ~$0.002 per analysis with gpt-4o-mini
- 1,000 analyses = ~$2
- 10,000 analyses = ~$20

Costs scale linearly with volume. The deterministic layer (Layer 1) requires no API calls — only Layer 2 uses the LLM.

---

## Can I use this for non-construction payroll?

The **core pattern** (deterministic extraction → constrained LLM reasoning → trust-scored routing) transfers to any domain where AI decisions need accountability:

- Healthcare claims validation
- Financial compliance (KYC, AML)
- Legal document review
- Insurance underwriting
- Revenue intelligence

The **regulatory logic** (Davis-Bacon prevailing wage rules) is domain-specific and would need replacement.

---

## How do I contribute?

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for:
- Development setup
- Test requirements
- Code style
- Architecture constraints (enforced by AST lint)

---

## Where can I learn more about Davis-Bacon compliance?

- [U.S. Department of Labor — Davis-Bacon Act](https://www.dol.gov/agencies/whd/government-contracts/construction)
- [Wage Determinations Online](https://wdol.gov/) (official DOL database)
- [SAM.gov](https://sam.gov/) (federal contract opportunities)
- [WH-347 Form](https://www.dol.gov/sites/dolgov/files/WHD/legacy/files/wh347.pdf) (official DOL form)

---

## Who built this?

**Vinícius Raposo** — systems engineer focused on AI infrastructure for regulated industries. See [About the Author](../..#about-the-author) in the README.

---

*Have a question not answered here? [Open an issue](https://github.com/FishRaposo/WCP-Compliance-Agent/issues) or check the [full documentation](../..#documentation).*
