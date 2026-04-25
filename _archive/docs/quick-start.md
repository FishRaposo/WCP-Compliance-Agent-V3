# Quick Start

**Get WCP Compliance Agent running in 5 minutes.**

This is a three-layer AI decision system that proves every compliance call with evidence. Think of it as a court case for every payroll decision — three layers of proof, every finding cites a regulation, every decision has a paper trail.

---

## What You Need

- Node.js 18+ ([download](https://nodejs.org/))
- An OpenAI API key ([get one here](https://platform.openai.com/api-keys))

---

## Run It

```bash
# 1. Clone
git clone https://github.com/FishRaposo/WCP-Compliance-Agent.git
cd WCP-Compliance-Agent
npm install

# 2. Add your API key
echo "OPENAI_API_KEY=sk-your-key-here" > .env

# 3. Start the server
npm run dev
```

Server runs at `http://localhost:3000`

---

## Try It

**Clean case — should approve:**
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"content": "Role: Electrician, Hours: 40, Wage: $52"}'
```

**Violation case — should reject + flag for review:**
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"content": "Role: Electrician, Hours: 45, Wage: $35"}'
```

---

## What You'll See

Every response includes:

| Field | What It Means |
|-------|---------------|
| `finalStatus` | Approved, Reject, or Needs Review |
| `trust.score` | 0.0 to 1.0 — confidence in the decision |
| `deterministic.checks` | Hard rules that passed or failed |
| `verdict.rationale` | LLM explanation citing those checks |
| `humanReview.required` | true if trust is too low for auto-approval |
| `auditTrail` | Complete evidence chain, timestamped |

**The point:** Every decision is traceable. If someone asks "why did the AI decide this?" — you can show them the exact evidence.

---

## Run Tests

```bash
npm test
```

Tests verify the three-layer pipeline works correctly — deterministic rules, LLM reasoning, and trust scoring.

---

## No API Key? Use Mock Mode

```bash
OPENAI_API_KEY=mock npm run dev
```

Returns deterministic responses without calling OpenAI. Good for offline development.

---

## Common Issues

**"OPENAI_API_KEY not set"**
```bash
echo "OPENAI_API_KEY=sk-your-key" > .env
```

**"Port 3000 in use"**
```bash
# Use a different port
PORT=3001 npm run dev
```

---

## What's Next

- **[README.md](../README.md)** — Project overview, architecture, and API reference
- **[docs/architecture/system-overview.md](./architecture/system-overview.md)** — System design and decision pipeline
- **[docs/compliance/regulatory-compliance-report.md](./compliance/regulatory-compliance-report.md)** — Davis-Bacon Act implementation

---

## Development Commands

| Command | What It Does |
|---------|--------------|
| `npm run dev` | Start with hot reload |
| `npm run build` | Compile TypeScript |
| `npm test` | Run all tests |
| `npm run lint:pipeline` | Verify three-layer architecture is intact |

---

*This isn't just payroll compliance. This is how you build AI systems that provably make correct decisions.*
