# Technical Implementation Guide

Status Label: Implemented

How Davis-Bacon Act regulations are translated into code within the WCP Compliance Agent.

---

## Purpose

This guide explains the connection between federal labor standards regulations and the technical implementation. It's designed for:

- **Developers** implementing new validation rules
- **Code reviewers** verifying regulatory compliance
- **Auditors** tracing requirements to code
- **Maintainers** updating logic as regulations change

---

## How Regulations Become Code

### Pattern: Regulation → Requirement → Algorithm → Implementation

```
Regulation (40 U.S.C. § 3142)
    ↓
Requirement: "Pay not less than prevailing wage"
    ↓
Algorithm: Compare reported_wage to prevailing_rate
    ↓
Implementation: TypeScript function with deterministic logic
```

---

## Core Implementation Patterns

### Pattern 1: Three-Layer Decision Architecture (NEW)

**Purpose:** Ensure regulatory compliance by separating deterministic facts from LLM reasoning, with human oversight for low-confidence cases.

**Regulatory Basis:** 
- Copeland Act (40 U.S.C. § 3145) requires accurate records
- 29 CFR 5.5 requires careful payroll review
- Audit trail requirements under federal contracting rules

**Architecture:**

```
┌─────────────────────────────────────────┐
│ Layer 1: Deterministic Scaffold         │
│ - Extraction, DBWD lookup, rule checks │
│ - NO AI involved                       │
│ - Output: DeterministicReport         │
└─────────────────┬───────────────────────┘
                  │ DeterministicReport
                  ▼
┌─────────────────────────────────────────┐
│ Layer 2: LLM Verdict                    │
│ - Reasoning over pre-computed findings │
│ - CANNOT recompute values              │
│ - Output: LLMVerdict                   │
└─────────────────┬───────────────────────┘
                  │ LLMVerdict
                  ▼
┌─────────────────────────────────────────┐
│ Layer 3: Trust Score + Human Review     │
│ - Compute trust (0.35/0.25/0.20/0.20)  │
│ - Apply thresholds                     │
│ - Enqueue low-trust for human review   │
│ - Output: TrustScoredDecision          │
└─────────────────────────────────────────┘
```

**Key Files:**
- `src/pipeline/layer1-deterministic.ts` - Deterministic layer
- `src/pipeline/layer2-llm-verdict.ts` - LLM reasoning
- `src/pipeline/layer3-trust-score.ts` - Trust computation
- `src/pipeline/orchestrator.ts` - Pipeline composer

**Trust Formula:**
```
trust = 0.35 × deterministicScore
      + 0.25 × classificationConfidence
      + 0.20 × llmSelfConfidence
      + 0.20 × agreementScore
```

**Thresholds:**
- ≥0.85: Auto-decide (no human review)
- 0.60–0.84: Flag for optional review
- <0.60: Require human review (blocking)

**Enforcement:**
```bash
npm run lint:pipeline      # AST check for architectural violations
npm run test:pipeline      # Unit + integration tests
npm run test:calibration   # Golden set evaluation
```

**Documentation:**
- [Decision Architecture Doctrine](../architecture/decision-architecture.md)
- [Trust Scoring](../architecture/trust-scoring.md)
- [ADR-005: Three-Layer Architecture](../adrs/ADR-005-decision-architecture.md)

---

### Pattern 2: Deterministic Validation

**Regulation:** 40 U.S.C. § 3142(a) - Prevailing Wage  
**Requirement:** Workers must be paid ≥ prevailing wage rate  
**Implementation Approach:**

```typescript
/**
 * Why deterministic? 
 * 
 * LLMs can hallucinate wage rates. Deterministic code guarantees:
 * - 100% arithmetic accuracy
 * - Reproducible results (same input = same output)
 * - Exact calculations regulators can verify
 * 
 * Regulatory Basis:
 * - 40 U.S.C. § 3142(a): "wages... not less than those prevailing"
 * - 29 CFR 5.22: "The minimum monetary wages... shall be not less than 
 *   the prevailing wage rates determined by the Secretary of Labor"
 */

function validatePrevailingWage(
  reportedWage: number,
  prevailingRate: number,
  classification: string
): ValidationResult {
  
  // Deterministic comparison - no LLM estimation
  if (reportedWage < prevailingRate) {
    const difference = reportedWage - prevailingRate;
    
    return {
      status: "VIOLATION",
      regulation: "40 U.S.C. § 3142(a)",
      finding: {
        check: "base_wage",
        severity: "error", // Always error for wage violations
        expected: prevailingRate,
        actual: reportedWage,
        difference: difference,
        // Regulators can verify this math exactly
        calculation: `${reportedWage} < ${prevailingRate} = VIOLATION`
      }
    };
  }
  
  return { status: "COMPLIANT" };
}
```

**Key Design Decisions:**
1. **No LLM for arithmetic** - Use deterministic math for exactness
2. **No floating point tolerance** - Exact comparison (not `abs(diff) < 0.01`)
3. **Clear regulation citation** - Every finding includes statutory reference
4. **Calculation transparency** - Show the exact comparison for audit

---

### Pattern 2: Hybrid Classification Matching

**Regulation:** 29 CFR 5.5(a)(3)(i) - Accurate Classification  
**Requirement:** Workers classified per work performed  
**Implementation Approach:**

```typescript
/**
 * Classification is hard because:
 * - Payroll titles vary ("Wireman" vs "Electrician")
 * - DBWD uses standardized terms
 * - Semantic similarity needed for matching
 * 
 * Regulatory Basis:
 * - 29 CFR 5.5(a)(3)(i): "[Workers] shall be classified in accordance 
 *   with the work performed"
 * 
 * Our 3-tier approach ensures accuracy while handling real-world variation.
 */

async function resolveClassification(
  payrollTitle: string,
  locality: string
): Promise<ClassificationResult> {
  
  // Tier 1: Exact match (100% confidence)
  // Fast, deterministic, zero ambiguity
  const exact = exactMatch(payrollTitle);
  if (exact) {
    return {
      classification: exact,
      confidence: 1.0,
      method: "exact_match",
      regulation: "29 CFR 5.5(a)(3)(i)"
    };
  }
  
  // Tier 2: Industry aliases (85-95% confidence)
  // "Wireman" → "Electrician" (industry standard)
  const alias = aliasMatch(payrollTitle);
  if (alias && alias.confidence > 0.85) {
    return {
      classification: alias.classification,
      confidence: alias.confidence,
      method: "alias_database",
      note: `Mapped "${payrollTitle}" to "${alias.classification}"`,
      regulation: "29 CFR 5.5(a)(3)(i)"
    };
  }
  
  // Tier 3: Semantic similarity (70-85% confidence)
  // Use embeddings for "Drywall Hanger" → "Carpenter"
  const semantic = await semanticMatch(payrollTitle, locality);
  if (semantic && semantic.confidence > 0.70) {
    return {
      classification: semantic.classification,
      confidence: semantic.confidence,
      method: "semantic_similarity",
      candidates: semantic.topMatches, // Show alternatives
      regulation: "29 CFR 5.5(a)(3)(i)"
    };
  }
  
  // Too uncertain - escalate to human
  // Better to ask than guess wrong
  return {
    status: "REVISION_NEEDED",
    reason: "Classification ambiguous",
    confidence: semantic?.confidence || 0,
    action: "Human review required",
    regulation: "29 CFR 5.5(a)(3)(i)"
  };
}
```

**Confidence Thresholds:**

| Confidence | Action | Rationale |
|------------|--------|-----------|
| ≥95% | Auto-approve | Near-certain match, minimal risk |
| 85-94% | Approve with warning | Industry standard aliases |
| 70-84% | Escalate | Semantic match but needs verification |
| <70% | Reject | Too uncertain for compliance decision |

---

### Pattern 3: Overtime Calculation with Fringe Exclusion

**Regulation:** 40 U.S.C. § 3702 + 29 CFR 5.22  
**Requirement:** Overtime at 1.5× base rate (fringe NOT multiplied)  
**Implementation Approach:**

```typescript
/**
 * Overtime calculation is the most common violation.
 * 
 * Many contractors pay the same rate for all hours (wrong)
 * or multiply fringe by 1.5 (also wrong).
 * 
 * Regulatory Requirements:
 * - 40 U.S.C. § 3702: "time and one-half the basic rate"
 * - 29 CFR 5.22: Fringe benefits "shall be paid" but NOT "multiplied by 1.5"
 * 
 * Correct Formula:
 * Regular: (baseRate + fringeRate) × regularHours
 * Overtime: (baseRate × 1.5 + fringeRate) × overtimeHours
 */

function calculateOvertimePay(
  baseRate: number,
  fringeRate: number,
  regularHours: number,
  overtimeHours: number
): OvertimeCalculation {
  
  // Regular time: full rate (base + fringe)
  const regularPay = (baseRate + fringeRate) * regularHours;
  
  // Overtime: 1.5x BASE ONLY, fringe at straight time
  const overtimeBaseComponent = baseRate * 1.5 * overtimeHours;
  const overtimeFringeComponent = fringeRate * overtimeHours;
  const overtimePay = overtimeBaseComponent + overtimeFringeComponent;
  
  return {
    regularPay,
    overtimePay,
    totalPay: regularPay + overtimePay,
    breakdown: {
      regular: {
        base: baseRate * regularHours,
        fringe: fringeRate * regularHours
      },
      overtime: {
        baseAt1_5x: baseRate * 1.5 * overtimeHours,
        fringeAtStraight: fringeRate * overtimeHours
      }
    },
    // Show calculation for audit transparency
    calculation: `
      Regular: (${baseRate} + ${fringeRate}) × ${regularHours} = ${regularPay}
      OT: (${baseRate} × 1.5 × ${overtimeHours}) + (${fringeRate} × ${overtimeHours}) = ${overtimePay}
    `
  };
}

// Validation function
function validateOvertimeRate(
  reportedOvertimeRate: number,
  baseRate: number
): ValidationResult {
  
  const requiredOvertimeRate = baseRate * 1.5;
  
  // Most common error: paying regular rate for overtime
  if (Math.abs(reportedOvertimeRate - baseRate) < 0.01) {
    return {
      status: "VIOLATION",
      severity: "critical", // Higher severity - systemic error
      regulation: "40 U.S.C. § 3702",
      finding: {
        check: "overtime_rate",
        message: "CRITICAL: Overtime paid at regular rate. Must be 1.5x base.",
        expected: requiredOvertimeRate,
        actual: reportedOvertimeRate,
        difference: requiredOvertimeRate - reportedOvertimeRate,
        example: `If base = ${baseRate}, OT must = ${baseRate} × 1.5 = ${requiredOvertimeRate}`
      }
    };
  }
  
  // Standard underpayment check
  if (reportedOvertimeRate < requiredOvertimeRate) {
    return {
      status: "VIOLATION",
      severity: "error",
      regulation: "40 U.S.C. § 3702",
      finding: {
        check: "overtime_rate",
        expected: requiredOvertimeRate,
        actual: reportedOvertimeRate,
        difference: requiredOvertimeRate - reportedOvertimeRate
      }
    };
  }
  
  return { status: "COMPLIANT" };
}
```

**Common Errors Detected:**

| Error | Example | Detection |
|-------|---------|-----------|
| Same rate for all hours | Pay $38.50 for regular AND overtime | `if (regularRate === overtimeRate)` |
| Fringe multiplied | ($38.50 + $21.68) × 1.5 = $90.27 | Separate base and fringe calc |
| Wrong threshold | OT after 8 hours/day (not 40/week) | Check total hours > 40 |
| Missing OT pay | Worked 45 hours, paid for 40 | Hours cross-check |

---

### Pattern 4: Audit Trail with Replay

**Regulation:** Copeland Act (40 U.S.C. § 3145)  
**Requirement:** Furnish statement on wages paid (audit trail)  
**Implementation Approach:**

```typescript
/**
 * Every decision must be auditable months or years later.
 * Regulators need to verify:
 * - What data was submitted
 * - Which wage rates applied at the time
 * - How the decision was calculated
 * - That replay produces identical results
 * 
 * Regulatory Basis:
 * - Copeland Act (40 U.S.C. § 3145): "furnish a statement on the wages 
 *   paid each employee..."
 * - 29 CFR 5.5(a)(3): Record keeping requirements
 */

interface ComplianceRecord {
  // Unique identifier for this decision
  traceId: string;  // e.g., "wcp-2024-01-15-001"
  
  // When the decision was made
  timestamp: string;  // ISO 8601
  
  // What was submitted (immutable snapshot)
  payrollData: WCPData;
  
  // What was decided
  decision: WCPDecision;
  
  // Which regulations were applied
  regulationsApplied: string[];  // ["40 U.S.C. § 3142", "40 U.S.C. § 3702"]
  
  // Which wage determinations were in effect
  dbwdVersion: string;  // e.g., "2024-Q1-Mod-03"
  
  // Which DBWD rates were used for each worker
  wageRatesApplied: {
    classification: string;
    dbwdId: string;
    baseRate: number;
    fringeRate: number;
    effectiveDate: string;
  }[];
  
  // Processing steps for transparency
  processingSteps: {
    step: string;
    timestamp: string;
    input: unknown;
    output: unknown;
  }[];
}

async function storeComplianceRecord(record: ComplianceRecord): Promise<void> {
  // Persist to database with 7-year retention
  await db.query(`
    INSERT INTO compliance_records (...)
    VALUES (...)
  `, [/* record data */]);
  
  // Also log to append-only audit log
  await auditLog.append({
    type: "compliance_decision",
    traceId: record.traceId,
    timestamp: record.timestamp,
    hash: hashRecord(record)  // Tamper detection
  });
}

/**
 * Replay a decision for regulatory audit.
 * Must produce identical results using same historical data.
 */
export async function replayDecision(traceId: string): Promise<ReplayResult> {
  // 1. Fetch the original record
  const original = await getComplianceRecord(traceId);
  
  // 2. Reconstruct the environment at decision time
  const historicalConfig = {
    dbwdVersion: original.dbwdVersion,
    // Use archived DBWD rates, not current rates
    useHistoricalRates: true,
    // Use same model version if applicable
    modelVersion: original.modelVersion
  };
  
  // 3. Re-run the validation
  const replayed = await validateWCP(original.payrollData, historicalConfig);
  
  // 4. Compare results
  const comparison = {
    status: compareStatus(original.decision, replayed),
    findingsMatch: compareFindings(original.decision, replayed),
    citationsMatch: compareCitations(original.decision, replayed),
    calculationsMatch: compareCalculations(original.decision, replayed)
  };
  
  return {
    traceId,
    original: original.decision,
    replayed,
    comparison,
    // For audit certification
    certified: comparison.status === "identical",
    auditNotes: comparison.status === "identical" 
      ? "Decision verified - replay produces identical results"
      : `Differences found: ${comparison.differences.join(", ")}`
  };
}
```

**Audit Query Example:**

```bash
# DOL investigator requests decision from 18 months ago
curl -X POST /api/compliance/replay \
  -H "Authorization: Bearer $DOL_TOKEN" \
  -d '{"traceId": "wcp-2023-07-12-456"}'

# Response shows:
# - Original payroll data
# - Wage determinations that applied at the time
# - Step-by-step validation logic
# - Comparison to replay result
# - Audit certification
```

---

## Code Structure by Regulation

### 1. Prevailing Wage (40 U.S.C. § 3142)

**Files:**
- `src/mastra/tools/wcp-tools.ts` - Core validation logic
- `src/services/dbwd-service.ts` - DBWD rate retrieval

**Key Functions:**
```typescript
// wcp-tools.ts
function validatePrevailingWage(...)        // Main validation
function checkBaseRate(...)                 // Base wage check
function checkFringeRate(...)               // Fringe benefits check

// dbwd-service.ts
function retrieveWageDetermination(...)     // DBWD corpus query
function getPrevailingRate(...)             // Rate extraction
```

**Data Flow:**
```
WCP Input
  ↓
extractWCPTool (parse role, locality)
  ↓
DBWDService.retrieveWageDetermination (query corpus)
  ↓
validatePrevailingWage (compare rates)
  ↓
Finding (if underpaid) with citation
```

---

### 2. Overtime (40 U.S.C. § 3702)

**Files:**
- `src/mastra/tools/wcp-tools.ts`

**Key Functions:**
```typescript
function validateOvertime(...)               // Main OT validation
function calculateOvertimeRate(...)          // 1.5x calculation
function checkHoursThreshold(...)            // 40-hour check
function detectSameRateError(...)            // Common violation
```

**Critical Implementation Detail:**
```typescript
// WRONG - Multiplies everything by 1.5
const wrongOvertimeRate = (baseRate + fringeRate) * 1.5;

// CORRECT - Only base rate multiplied
const correctOvertimeRate = baseRate * 1.5;  // Fringe stays at straight time
```

---

### 3. Classification (29 CFR 5.5(a)(3)(i))

**Files:**
- `src/services/classification-service.ts`
- `src/data/trade-aliases.ts`

**Key Functions:**
```typescript
// classification-service.ts
function resolveClassification(...)        // Main resolver
function exactMatch(...)                    // Tier 1: Exact
function aliasMatch(...)                    // Tier 2: Aliases
function semanticMatch(...)               // Tier 3: Semantic

// trade-aliases.ts
const TRADE_ALIASES = {                     // Industry synonym database
  "Wireman": "ELECTRICIAN",
  "Cement Finisher": "CEMENT MASON/CONCRETE FINISHER",
  // ... 100+ entries
};
```

---

### 4. Record Keeping (Copeland Act + 29 CFR 5.5)

**Files:**
- `src/services/audit-service.ts`
- `src/entrypoints/wcp-entrypoint.ts`

**Key Functions:**
```typescript
// audit-service.ts
function storeComplianceRecord(...)        // Persist decision
function replayDecision(...)                // Audit replay
function generateTraceId(...)               // Unique ID

// wcp-entrypoint.ts
function generateWcpDecision(...)          // Orchestrate + trace
```

---

## Testing Regulatory Compliance

### Unit Test Pattern

```typescript
// test-prevailing-wage.ts
describe('40 U.S.C. § 3142(a) - Prevailing Wage', () => {
  
  test('should detect underpayment', async () => {
    // Arrange
    const payroll = {
      classification: 'Electrician',
      wage: 35.50,  // Below prevailing
      hours: 40,
      locality: 'Los Angeles, CA'
    };
    
    const prevailingRate = 38.50;  // From DBWD
    
    // Act
    const result = await validatePrevailingWage(payroll, prevailingRate);
    
    // Assert
    expect(result.status).toBe('VIOLATION');
    expect(result.finding.regulation).toBe('40 U.S.C. § 3142(a)');
    expect(result.finding.expected).toBe(38.50);
    expect(result.finding.actual).toBe(35.50);
    expect(result.finding.difference).toBe(-3.00);
  });
  
  test('should approve compliant wage', async () => {
    const payroll = { wage: 38.50, /* ... */ };
    const prevailingRate = 38.50;
    
    const result = await validatePrevailingWage(payroll, prevailingRate);
    
    expect(result.status).toBe('COMPLIANT');
  });
});
```

### Integration Test Pattern

```typescript
// test-end-to-end-compliance.ts
describe('End-to-End Davis-Bacon Compliance', () => {
  
  test('full validation workflow', async () => {
    // Submit a WH-347 style payroll
    const response = await request(app)
      .post('/api/analyze')
      .send({
        payload: 'Role: Electrician, Hours: 45, Wage: 35.50'
      });
    
    // Verify all applicable regulations checked
    expect(response.body.findings).toContainEqual(
      expect.objectContaining({
        check: 'base_wage',
        regulation: '40 U.S.C. § 3142(a)'
      })
    );
    
    expect(response.body.findings).toContainEqual(
      expect.objectContaining({
        check: 'overtime_rate',
        regulation: '40 U.S.C. § 3702'
      })
    );
    
    // Verify trace ID for audit
    expect(response.body.trace.requestId).toBeDefined();
  });
});
```

---

## Adding New Regulatory Requirements

### Step-by-Step Guide

**Scenario:** New regulation requires tracking apprenticeship ratios

**Step 1: Identify the Regulation**
```typescript
/**
 * New Requirement: 29 CFR 5.18 - Apprenticeship Ratios
 * 
 * "The employment of apprentices shall be in conformance 
 * with the apprenticeship standards..."
 * 
 * System Impact: Need to validate apprentice:journeyman ratios
 */
```

**Step 2: Add to Traceability Matrix**
```markdown
| 29 CFR 5.18 | Apprentice ratio validation | validateApprenticeRatio() | test-apprentice-ratio.ts | 🔲 |
```

**Step 3: Implement Validation Function**
```typescript
// src/mastra/tools/wcp-tools.ts

/**
 * Apprentice Ratio Validation
 * 
 * Regulatory Basis:
 * - 29 CFR 5.18: Apprenticeship standards conformance
 * 
 * Most DBWDs specify max apprentice:journeyman ratio (e.g., 1:3)
 */
function validateApprenticeRatio(
  apprenticeCount: number,
  journeymanCount: number,
  classification: string,
  dbwd: WageDetermination
): ValidationResult {
  
  const maxRatio = dbwd.apprenticeRatio || { apprentices: 1, journeymen: 3 };
  
  const actualRatio = apprenticeCount / journeymanCount;
  const maxAllowed = maxRatio.apprentices / maxRatio.journeymen;
  
  if (actualRatio > maxAllowed) {
    return {
      status: "VIOLATION",
      regulation: "29 CFR 5.18",
      finding: {
        check: "apprentice_ratio",
        severity: "error",
        expected: `${maxRatio.apprentices}:${maxRatio.journeymen}`,
        actual: `${apprenticeCount}:${journeymanCount}`,
        message: `Apprentice ratio exceeds maximum allowed`
      }
    };
  }
  
  return { status: "COMPLIANT" };
}
```

**Step 4: Add Tests**
```typescript
// tests/unit/test-apprentice-ratio.ts
describe('29 CFR 5.18 - Apprentice Ratios', () => {
  test('should detect excessive apprentice ratio', () => {
    // 5 apprentices, 3 journeymen = 1.67 ratio
    // Max allowed: 1:3 = 0.33 ratio
    const result = validateApprenticeRatio(5, 3, 'Electrician', dbwd);
    expect(result.status).toBe('VIOLATION');
  });
});
```

**Step 5: Update Documentation**
- Add to `traceability-matrix.md`
- Add example to `regulatory-compliance-report.md`
- Update `implementation-guide.md` (this doc)

---

## Common Pitfalls

### 1. Using LLM for Arithmetic

**Wrong:**
```typescript
// Don't do this - LLMs make arithmetic errors
const result = await llm.complete(`
  Is $35.50 less than the prevailing wage of $38.50?
`);
```

**Right:**
```typescript
// Deterministic comparison is exact
const isUnderpaid = reportedWage < prevailingRate;  // true/false
```

### 2. Missing Regulation Citations

**Wrong:**
```typescript
return { status: "VIOLATION", reason: "Underpaid" };
```

**Right:**
```typescript
return {
  status: "VIOLATION",
  regulation: "40 U.S.C. § 3142(a)",
  finding: { /* ... */ }
};
```

### 3. Not Handling Edge Cases

**Wrong:**
```typescript
// Assumes classification always found
const rate = dbwdRates[classification];
```

**Right:**
```typescript
// Handle unknown classifications
if (!dbwdRates[classification]) {
  return {
    status: "REVISION_NEEDED",
    reason: `Unknown classification: ${classification}`,
    action: "Please verify job title against DBWD"
  };
}
```

---

## Resources

### Official Regulatory Sources

- **Davis-Bacon Act:** 40 U.S.C. §§ 3141-3144, 3146-3147
- **Copeland Act:** 40 U.S.C. § 3145
- **DOL Regulations:** 29 CFR Parts 3, 5
- **Form WH-347:** https://www.dol.gov/agencies/whd/forms/wh347

### Internal Documentation

- [Traceability Matrix](./traceability-matrix.md) - Regulation ↔ Code mapping
- [Regulatory Compliance Report](./regulatory-compliance-report.md) - System overview
- [WCP and DBWD Reference](../foundation/wcp-and-dbwd-reference.md) - Domain knowledge

---

**See Also:**
- [Architecture Decisions](../../decisions/) - Why we chose this approach
- [Evaluation Strategy](../evaluation/evaluation-strategy.md) - Testing methodology

*Last Updated: January 2024*
