# System Overview

WCP Compliance Agent is a three-layer AI decision system for federal construction payroll validation. Every decision is explainable, traceable, and defensible — designed for regulated environments where AI errors have real consequences.

This document explains the architecture, design principles, and how the three layers work together to produce trustworthy compliance decisions.

---

## Table of Contents

1. [Design Principles](#design-principles)
2. [The Three Layers](#the-three-layers)
3. [End-to-End Flow](#end-to-end-flow)
4. [Trust and Accountability](#trust-and-accountability)
5. [Current Implementation](#current-implementation)
6. [Target Architecture](#target-architecture)
7. [Technology Choices](#technology-choices)
8. [Architecture Enforcement](#architecture-enforcement)

---

## Design Principles

### Deterministic First, AI Second

The most critical logic — arithmetic, policy rules, and regulatory thresholds — runs in deterministic code that is fully testable and auditable. The AI (LLM) only operates on validated context, never on raw input. This means:

- Wage calculations cannot be hallucinated
- Overtime rules cannot be misinterpreted
- Fringe benefit checks follow exact statutory formulas

The LLM's job is interpretation and validation, not computation.

### Every Decision Has a Paper Trail

Every compliance decision produces:
- **Deterministic check results** with pass/fail status and regulation citations
- **LLM reasoning** that references specific checks (never raw input)
- **Trust score** with confidence band and routing decision
- **Audit trail** with timestamps for every pipeline step
- **Trace ID** for appeals, investigations, and replay

If an auditor asks "why did you approve this payroll?" — the system produces the exact evidence.

### Constrained, Not Creative

The LLM layer operates under strict constraints:
- Cannot modify values from deterministic extraction
- Must cite specific statutes (40 U.S.C. § 3142, 29 CFR 5.5, etc.)
- Must reference check IDs, not invent findings
- Operates within a bounded reasoning horizon (max 3 steps)

This is not general-purpose AI. This is constrained reasoning over validated evidence.

---

## The Three Layers

### Layer 1: Deterministic Extraction and Validation

**Files:** `src/pipeline/layer1-*.ts`

**What it does:**
1. **Extract** role, hours, wage, fringe benefits from payroll text
2. **Validate** against Department of Labor prevailing wage determinations
3. **Check** overtime calculations (1.5× for hours over 40)
4. **Verify** fringe benefit sufficiency
5. **Confirm** worker classification matches job type

**How it works:**
- Pure TypeScript functions — no AI, no machine learning
- Regular expressions and arithmetic for extraction
- JSON-configurable wage corpus (20 trades out of the box)
- Every check produces a structured result with regulation citation

**Example output:**
```json
{
  "id": "wage_check_001",
  "type": "base_wage",
  "status": "pass",
  "regulation": "40 U.S.C. § 3142",
  "message": "Wage $51.69 meets prevailing rate $51.69 for Electrician in locality"
}
```

**Why this matters:** If the LLM layer fails or hallucinates, Layer 1 results are still valid, testable, and defensible in court.

---

### Layer 2: LLM Verdict

**Files:** `src/pipeline/layer2-*.ts`

**What it does:**
1. **Review** Layer 1 check results
2. **Confirm** regulatory interpretation
3. **Synthesize** a verdict with rationale
4. **Cite** specific statutes

**Constraints:**
- Cannot access raw payroll text (only Layer 1 results)
- Cannot recompute or modify any values
- Must reference check IDs in rationale
- Must cite at least one statute

**Example output:**
```json
{
  "status": "Approved",
  "rationale": "All checks pass. Wage meets prevailing rate (wage_check_001). Overtime correctly calculated (overtime_check_002). Fringe benefits sufficient (fringe_check_003).",
  "referencedCheckIds": ["wage_check_001", "overtime_check_002", "fringe_check_003"],
  "citations": ["40 U.S.C. § 3142", "29 CFR 5.5(a)(1)"]
}
```

**Why this matters:** The LLM provides interpretive depth — explaining *why* the findings matter in regulatory context — without risking the mathematical integrity of the decision.

---

### Layer 3: Trust Score and Routing

**Files:** `src/pipeline/layer3-*.ts`

**What it does:**
1. **Score** confidence based on four components:
   - Deterministic check results (pass/fail weight)
   - LLM confidence (certainty of interpretation)
   - Data completeness (all fields extractable?)
   - Regulation specificity (precise citations?)
2. **Route** decisions based on score:
   - **Auto** (≥0.75): Approve without human review
   - **Flag** (0.60–0.74): Approve but log for periodic audit
   - **Human** (<0.60): Route to human reviewer

**Example output:**
```json
{
  "score": 0.92,
  "band": "auto",
  "components": {
    "deterministic": 1.0,
    "llmConfidence": 0.85,
    "dataCompleteness": 1.0,
    "regulationSpecificity": 0.95
  }
}
```

**Why this matters:** Not every decision should be automated. The trust score creates a safety valve, ensuring low-confidence cases get human eyes.

---

## End-to-End Flow

```
Payroll Input (text / PDF / CSV)
    │
    ▼
┌─────────────────────────────────┐
│  Layer 1: Deterministic         │  Extract + validate. No AI.
│  src/pipeline/layer1-*.ts       │  Output: CheckResult[]
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Layer 2: LLM Verdict           │  Reason over findings.
│  src/pipeline/layer2-*.ts       │  Output: LLMVerdict
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Layer 3: Trust Score           │  Score + route.
│  src/pipeline/layer3-*.ts       │  Output: TrustScoredDecision
└──────────────┬──────────────────┘
               │
               ▼
         Final Decision + Full Audit Trail
```

**Timing:**
- Layer 1: ~10ms (pure arithmetic)
- Layer 2: ~500ms–2s (LLM API call)
- Layer 3: ~5ms (weighted scoring)
- **Total: ~1–3 seconds per payroll**

---

## Trust and Accountability

### Audit Trail

Every decision includes a timestamped record of:
- Input received (sanitized)
- Layer 1 checks performed and results
- Layer 2 verdict and citations
- Layer 3 score and routing decision
- Final status and human review flag

### Trace ID

Every decision receives a unique trace ID (e.g., `wcp-2026-04-22-abc123`). This ID:
- Links to the full audit trail
- Enables appeals and investigations
- Supports replay for debugging

### Regression Detection

A **102-example golden set** tests the pipeline on every code change:
- Known correct outcomes for common scenarios
- Edge cases (overtime, fringe, classification errors)
- If any example changes outcome unexpectedly, the build fails

---

## Current Implementation

The current V2 implementation is a **self-contained TypeScript/Node.js application** with:

- **310 tests** covering unit, integration, calibration, and e2e
- **83%+ code coverage** with 80% CI gate
- **Zero external dependencies** for core functionality (mock mode)
- **PDF and CSV upload** for document ingestion
- **In-memory storage** with optional PostgreSQL persistence
- **Rate limiting** at 60 requests/minute

**Known limitations (documented for V3):**
- Hybrid retrieval (BM25 + vector) is structured but not connected to live Elasticsearch
- Human review queue is in-memory only
- DBWD rate updates require manual ETL pipeline

---

## Target Architecture (V3)

V3 restructures into a **production-grade polyglot system:**

- **Python backend** (FastAPI): deterministic Layer 1, DBWD ETL from DOL/SAM.gov, persistent audit store
- **TypeScript agent** (Mastra.ai): Layer 2 LLM reasoning, prompt versioning via Langfuse
- **React 19 frontend**: multi-employee accordion, cost tracking dashboard, human review queue UI
- **Infrastructure**: Docker Compose with PostgreSQL + pgvector + Redis + Elasticsearch
- **Observability**: Phoenix LLM tracing + OpenTelemetry

See [V3 Plan](../v3/V3_PLAN.md) for the full technical roadmap.

---

## Technology Choices

| Component | Technology | Why |
|---|---|---|
| Runtime | Node.js 22+ | LTS, native ESM, performance |
| HTTP | Hono | Lightweight, TypeScript-native |
| LLM | OpenAI gpt-4o-mini | Cost-effective, structured output |
| Validation | Zod | Runtime + compile-time safety |
| Testing | Vitest | Fast, native ESM support |
| Frontend | React 19 + Vite | Modern, fast HMR |

See [Tech Stack](../tech-stack.md) for full details.

---

## Architecture Enforcement

The three-layer pipeline is **protected at build time** via AST-based lint (`npm run lint:pipeline`):

- Layer 1 cannot call LLM APIs
- Layer 2 cannot modify Layer 1 values
- Layer 3 cannot call LLM APIs directly
- Every decision must have an audit trail
- Every verdict must cite regulations

**Violations are build failures.** The architecture is not a guideline — it's enforced code.

---

*See [README](../../README.md) for quick start, [API Reference](../api-reference.md) for endpoints, and [FAQ](../faq.md) for common questions.*

*Last updated: 2026-04-22*
