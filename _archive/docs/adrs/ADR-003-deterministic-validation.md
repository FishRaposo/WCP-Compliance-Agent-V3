# ADR-003: Deterministic Validation Layer

Status: **Accepted**

Date: January 2024

## Context

The WCP Compliance Agent makes high-stakes decisions about wage compliance. Errors can result in:
- Underpaid workers (legal liability)
- False violations (contractor disputes)
- Regulatory penalties (fines, debarment)

We need a validation strategy that guarantees accuracy for objective checks while allowing flexibility for subjective analysis.

Options considered:
1. **Pure LLM**: All validation done by language model
2. **Pure deterministic**: All validation done by code/rules
3. **Hybrid**: Deterministic for objective checks, LLM for subjective analysis

## Decision

**We will use a hybrid approach with a deterministic validation layer for objective checks and LLM assistance for subjective analysis and explanation generation.**

## Rationale

### Why not pure LLM?

**The problem:**
```
"Hey GPT, is $35.50/hour compliant for an Electrician in LA?"

GPT might respond:
- "Yes, that seems fair" ❌ (hallucinated)
- "The rate is $38.50" ✅ (correct this time)
- "According to my knowledge, it's $37.00" ❌ (outdated)

Problems:
- No guarantee of correctness
- Arithmetic errors (2+2 sometimes = 5)
- No citations to verify
- Different answers on different days
```

**Real-world example:**
- Input: "Role: Electrician, Hours: 45, Wage: 35.50"
- Required: $38.50 base + $57.75 overtime
- LLM might say: "This looks compliant" ❌ (wrong)
- Actual: $231.25 underpayment ❌

### Why not pure deterministic?

**Strengths:**
- Perfect arithmetic accuracy
- Reproducible results
- Fast execution
- Easy to audit

**Weaknesses:**
- Can't handle ambiguity
- No natural language explanations
- Rigid (can't adapt to edge cases)
- Difficult to maintain complex rule sets

**Example where pure deterministic struggles:**
- Input: "Worked as Wireman on electrical crew"
- Deterministic: "Wireman not in rate table" ❌
- Needed: "Wireman is synonym for Electrician" ✅

### Why hybrid?

**Division of labor:**

| Task | Method | Reason |
|------|--------|--------|
| **Arithmetic** | Deterministic | Must be exact |
| **Rate lookups** | Deterministic | Facts, not opinions |
| **Job title matching** | Hybrid | Rules + synonyms |
| **Explanation writing** | LLM | Natural language nuance |
| **Ambiguity detection** | LLM | Context understanding |
| **Citation formatting** | Deterministic | Structured output |

**Principle:**
> Use deterministic code for what must be exact. Use LLMs for what benefits from nuance.

## Architecture

```
Input: WCP Report
        │
        ▼
┌───────────────────┐
│  Extraction       │
│  (Deterministic)  │ Regex/structured parsing
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Validation       │
│  (Deterministic)  │ Arithmetic, rate comparisons
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Evidence         │
│  Retrieval        │ Hybrid search (BM25 + vector)
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Decision         │
│  Generation       │ Schema-bound LLM call
│  (LLM-assisted)   │ Explanation + confidence
└─────────┬─────────┘
          │
          ▼
Output: Decision with citations
```

## Implementation

### Deterministic validation code

```typescript
// src/mastra/tools/wcp-tools.ts

interface ValidationResult {
  status: 'COMPLIANT' | 'VIOLATION';
  findings: Finding[];
}

export function validateWCP(data: WCPData): ValidationResult {
  const findings: Finding[] = [];
  
  // 1. Base wage check (deterministic)
  const prevailingRate = getPrevailingRate(data.role, data.locality);
  if (data.wage < prevailingRate.base) {
    findings.push({
      check: 'base_wage',
      expected: prevailingRate.base,
      actual: data.wage,
      difference: data.wage - prevailingRate.base,
      severity: 'error',
    });
  }
  
  // 2. Overtime hours calculation (deterministic)
  const regularHours = Math.min(data.hours, 40);
  const overtimeHours = Math.max(0, data.hours - 40);
  
  // 3. Overtime rate check (deterministic)
  const requiredOvertimeRate = prevailingRate.base * 1.5;
  const actualOvertimeRate = data.wage; // Simplified; real logic more complex
  
  if (overtimeHours > 0 && actualOvertimeRate < requiredOvertimeRate) {
    findings.push({
      check: 'overtime_rate',
      expected: requiredOvertimeRate,
      actual: actualOvertimeRate,
      difference: actualOvertimeRate - requiredOvertimeRate,
      severity: 'critical',
    });
  }
  
  // 4. Arithmetic validation (deterministic)
  const calculatedTotal = (regularHours * data.wage) + 
                          (overtimeHours * actualOvertimeRate);
  // Compare with reported total if available
  
  return {
    status: findings.length > 0 ? 'VIOLATION' : 'COMPLIANT',
    findings,
  };
}
```

### LLM-assisted explanation

```typescript
// Schema-bound LLM call
const decisionAgent = mastra.createAgent({
  id: 'wcp-decision',
  instructions: `Generate a clear explanation of the compliance decision based on the findings.`,
  model: openai('gpt-4o-mini'),
  output: WCPDecisionSchema, // Zod schema enforces structure
});

// The LLM receives deterministic findings and generates:
// - Natural language explanation
// - Confidence assessment
// - Citation formatting
// But cannot change the findings (schema constraint)
```

## Guarantees

### What deterministic validation guarantees

| Property | Guarantee | Verification |
|----------|-----------|------------|
| **Arithmetic accuracy** | 100% | Unit tests for all calculations |
| **Rate correctness** | 100% (given correct data) | Rate table validation |
| **Reproducibility** | Identical inputs → identical outputs | Replay tests |
| **Auditability** | Every check logged with values | Structured logs |
| **Latency** | <10ms | Benchmark tests |

### What LLM assistance provides

| Capability | LLM Role | Constraint |
|------------|----------|------------|
| **Explanations** | Generate human-readable text | Must cite specific findings |
| **Confidence** | Assess decision confidence | Schema-enforced 0-1 range |
| **Edge cases** | Handle ambiguous situations | Escalate if confidence < 0.8 |
| **Context** | Understand nuanced scenarios | Cannot override deterministic findings |

## Error handling

### Deterministic errors (fail fast)

```typescript
// src/utils/errors.ts

export class ValidationError extends WCPError {
  constructor(
    message: string,
    public stage: 'extraction' | 'validation' | 'retrieval',
    public input: unknown,
  ) {
    super(message, 'VALIDATION_ERROR');
  }
}

export class RateLookupError extends ValidationError {
  constructor(role: string, locality: string) {
    super(
      `No rate found for ${role} in ${locality}`,
      'validation',
      { role, locality }
    );
  }
}

// Usage
if (!rate) {
  throw new RateLookupError(data.role, data.locality);
  // Caught by orchestrator, escalated to human
}
```

### LLM errors (graceful degradation)

```typescript
// Fallback if LLM fails
try {
  const explanation = await generateExplanation(findings);
} catch (error) {
  // Fallback: structured explanation from findings
  const fallbackExplanation = findings
    .map(f => `${f.check}: Expected ${f.expected}, found ${f.actual}`)
    .join('; ');
  
  logger.warn('LLM explanation failed, using fallback', { error });
}
```

## Testing strategy

### Deterministic tests (must pass 100%)

```typescript
// tests/unit/validation.test.ts
describe('Deterministic Validation', () => {
  test.each([
    { role: 'Electrician', wage: 38.50, expected: 'COMPLIANT' },
    { role: 'Electrician', wage: 35.50, expected: 'VIOLATION' },
    { role: 'Laborer', wage: 28.00, expected: 'COMPLIANT' },
    { role: 'Laborer', wage: 25.00, expected: 'VIOLATION' },
  ])('$role at $wage → $expected', ({ role, wage, expected }) => {
    const result = validateWCP({ role, hours: 40, wage, locality: 'LA' });
    expect(result.status).toBe(expected);
  });
  
  test('overtime calculation is exact', () => {
    const result = validateWCP({
      role: 'Electrician',
      hours: 45,
      wage: 38.50,
      locality: 'LA'
    });
    
    const overtimeFinding = result.findings.find(f => f.check === 'overtime_rate');
    expect(overtimeFinding?.expected).toBe(57.75); // 38.50 * 1.5
    expect(overtimeFinding?.actual).toBe(38.50);
    expect(overtimeFinding?.difference).toBe(-19.25);
  });
});
```

### LLM output tests (quality checks)

```typescript
// tests/integration/decision.test.ts
describe('LLM Decision Generation', () => {
  test('explanation cites specific numbers', async () => {
    const result = await analyzeWCP({
      payload: 'Role: Electrician, Hours: 45, Wage: 35.50'
    });
    
    // Explanation must reference the actual numbers
    expect(result.explanation).toContain('35.50');
    expect(result.explanation).toContain('38.50');
    expect(result.explanation).toContain('57.75');
  });
  
  test('confidence reflects finding severity', async () => {
    const criticalResult = await analyzeWCP({
      payload: 'Role: Electrician, Hours: 45, Wage: 35.50'
    });
    
    const cleanResult = await analyzeWCP({
      payload: 'Role: Electrician, Hours: 40, Wage: 38.50'
    });
    
    // Critical findings should reduce confidence
    expect(criticalResult.confidence).toBeLessThan(cleanResult.confidence);
  });
});
```

## Alternatives considered

### Full rule engine (Drools, etc.)

- Industry-standard for complex business rules
- Would require additional infrastructure
- Overkill for our relatively simple validation logic
- Less transparent than TypeScript code

**Verdict**: Rejected—code is clearer for our use case.

### Constraint satisfaction solver

- Mathematical approach to validation
- Could optimize multi-employee scenarios
- Complex to implement and maintain
- Overkill for single-employee validation

**Verdict**: Rejected—not needed for MVP.

### LLM with few-shot prompting for math

- "Here are examples of correct calculations..."
- LLMs still make arithmetic errors even with examples
- No guarantee of correctness
- Higher cost (more tokens)

**Verdict**: Rejected—math must be exact.

## Metrics

### Validation performance

| Metric | Target | Current |
|--------|--------|---------|
| Arithmetic accuracy | 100% | 100% |
| Deterministic latency | <10ms | <1ms |
| Test coverage | >95% | 85% |

### Decision quality

| Metric | Target | Measurement |
|--------|--------|-------------|
| Explanation relevance | >90% | Human review |
| Confidence calibration | Well-calibrated | Brier score |
| False-approve rate | <2% | Golden set |

## References

- [Schema-bound LLM outputs](https://mastra.ai/docs/agents/02-adding-tools)
- [Zod validation](https://zod.dev/)
- [Type-safe errors](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [Deterministic vs probabilistic systems](https://www.anthropic.com/research)

## Status

- **Proposed**: January 2024
- **Accepted**: January 2024
- **Last reviewed**: January 2024

---

**Note**: This is the most critical architectural decision for the WCP Compliance Agent. The deterministic layer provides the trust foundation; the LLM layer provides usability. Neither alone would be sufficient.

---

**Implementation Status**: Structurally Implemented, Data Stubbed

**Current Code**:
- `src/pipeline/layer1-deterministic.ts` — Deterministic layer (extract, lookup, check)
- `src/mastra/tools/wcp-tools.ts` — Validation tools

**Data Status**: Uses hardcoded DBWD rates (2 roles: Electrician, Laborer)
