# Weekly Certified Payroll (WCP) and Davis-Bacon Wage Determinations (DBWD) Reference

Status Label: Implemented

Comprehensive reference for Davis-Bacon Act compliance, certified payroll requirements, and wage determination validation.

---

## Overview

The **Davis-Bacon Act** (enacted 1931) requires contractors and subcontractors on federal construction projects over $2,000 to pay workers not less than the prevailing wage rates and fringe benefits for similar work in the local area.

**Weekly Certified Payroll (WCP)** reports are the compliance mechanism—submitted weekly to prove workers received proper wages.

---

## Davis-Bacon Act Requirements

### Applicability

| Criterion | Requirement |
|-----------|-------------|
| **Contract value** | Federal construction contracts > $2,000 |
| **Project type** | Construction, alteration, repair of public buildings/works |
| **Covered workers** | Laborers and mechanics employed on the contract |
| **Payment frequency** | Weekly or more frequently |

### Key Compliance Obligations

1. **Pay prevailing wages** - Basic hourly rate + fringe benefits as determined by DOL
2. **Submit weekly certified payrolls** - Form WH-347 or equivalent format
3. **Maintain accurate records** - Employee info, classifications, hours, wages
4. **Statement of Compliance** - Signed certification of accuracy

### Consequences of Non-Compliance

- Withholding of contract payments
- Disqualification from future federal contracts
- Fines and legal action (see *United States v. Clark* - criminal conviction for falsified payrolls)
- Contract termination

---

## Weekly Certified Payroll (WCP) Form WH-347

### Form Structure

The U.S. Department of Labor Form WH-347 is the standard certified payroll form.

**Page 1: Payroll Information**

| Field | Description | Example |
|-------|-------------|---------|
| **Contractor/Subcontractor** | Company name and address | ABC Construction, 123 Main St |
| **Project** | Project name and location | Federal Courthouse, Los Angeles, CA |
| **Project ID** | Contract number | W912P4-23-C-0001 |
| **Week Ending** | Date (usually Friday) | 01/19/2024 |
| **Employee Name** | Full name | John Smith |
| **SSN** | Last 4 digits only | XXX-XX-1234 |
| **Job Classification** | DOL classification | Electrician, Laborer, Carpenter |
| **Hours by Day** | Mon-Sun daily hours | 8, 8, 8, 8, 8, 0, 0 |
| **Total Hours** | Sum of daily hours | 40 |
| **Hourly Rate** | Base wage rate | $38.50 |
| **Gross Wages** | Total weekly pay | $1,540.00 |
| **Deductions** | Taxes, benefits, etc. | $385.00 |
| **Net Wages** | Take-home pay | $1,155.00 |

**Page 2: Statement of Compliance**

A signed declaration stating:
- Payroll is accurate and complete
- Workers paid not less than prevailing wage rates
- Workers classified correctly per wage determination

---

## Davis-Bacon Wage Determinations (DBWD)

### Types of Wage Determinations

#### 1. General Wage Determinations (GWDs)

- Issued annually (first quarter "rollover")
- Cover most U.S. counties
- Separate schedules for: Building, Residential, Highway, Heavy construction
- Updated weekly (usually Friday) via modifications

**Official Source:** [SAM.gov Wage Determinations](https://sam.gov/content/wage-determinations)

#### 2. Project Wage Determinations

- Custom determinations for specific projects
- Requested via SF-308 form when no GWD applies
- Used for unique geographic areas or project types

### Wage Determination Format

```
GENERAL WAGE DETERMINATION
County: Los Angeles, CA
Construction Type: Building
Effective Date: 01/01/2024
Modification: 01

-----------------------------------------------------------------
ELEC0490-002 06/01/2022
Classification: ELECTRICIAN
Basic Hourly Rate:  $32.80
Fringe Benefits:    $21.68
Total Hourly Rate:  $54.48
-----------------------------------------------------------------
LABO0668-001 12/01/2022
Classification: LABORER: Common or General
Basic Hourly Rate:  $24.51
Fringe Benefits:    $20.82
Total Hourly Rate:  $45.33
-----------------------------------------------------------------
IRON0007-040 09/16/2022
Classification: IRONWORKER, STRUCTURAL
Basic Hourly Rate:  $29.71
Fringe Benefits:    $24.34
Total Hourly Rate:  $54.05
```

### Key Elements Explained

**Classification Identifier (e.g., ELEC0490-002)**
- Format: [TRADE][UNION/SOURCE CODE]-[MODIFICATION NUMBER]
- ELEC = Electrician
- 0490 = Union/survey identifier
- 002 = Modification number

**Date (e.g., 06/01/2022)**
- Effective date of the classification/rate
- May differ from wage determination effective date

**Basic Hourly Rate**
- Minimum cash wage that must be paid
- Does not include fringe benefits

**Fringe Benefits**
- Can be paid as: contributions to benefit plans, cash in lieu, or combination
- Must be paid in addition to basic rate or included in total

**Overtime Requirements**
- Time and one-half the basic rate for hours over 40/week
- Plus fringe benefits (not multiplied by 1.5)

---

## How the WCP Compliance Agent Validates WCP Against DBWD

### Validation Workflow

```
Input: Weekly Certified Payroll Report (WH-347)
              │
              ▼
┌─────────────────────────────┐
│  1. Document Parsing        │  OCR/extract structured data
│     (OCR/PDF Processing)    │  → Employee entries, classifications, hours, wages
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  2. Classification Matching │  Match job titles to DBWD classifications
│     (Retrieval + Aliases)   │  → "Wireman" → "Electrician"
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  3. Rate Lookup             │  Query DBWD corpus for prevailing rates
│     (Hybrid Search)         │  → Base rate, fringe, overtime calculation
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  4. Deterministic Validation│  Arithmetic checks:
│     (Arithmetic Engine)     │  - Base rate ≥ prevailing rate
│                             │  - Overtime = 1.5x base (if >40 hrs)
│                             │  - Gross wages = hours × rate
│                             │  - Total pay ≥ (base + fringe) × hours
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  5. Compliance Decision     │  Generate verdict with citations:
│     (LLM-Assisted)          │  - Status: COMPLIANT / VIOLATION / REVISION_NEEDED
│                             │  - Findings with severity levels
│                             │  - Citations to specific DBWD sections
│                             │  - Confidence score
└─────────────────────────────┘
```

### Specific Validations Performed

#### 1. Base Wage Compliance Check

**Logic:**
```typescript
if (reportedWage < prevailingBaseRate) {
  finding = {
    check: "base_wage",
    severity: "error",
    expected: prevailingBaseRate,
    actual: reportedWage,
    difference: reportedWage - prevailingBaseRate,
    citation: dbwdClassification.identifier
  };
}
```

**Example:**
- Employee: Electrician
- Reported wage: $35.50/hour
- DBWD prevailing: $38.50/hour (ELEC0490-002)
- **Result:** ❌ VIOLATION - Underpayment of $3.00/hour

#### 2. Overtime Rate Check

**Logic:**
```typescript
if (hours > 40) {
  overtimeHours = hours - 40;
  requiredOvertimeRate = prevailingBaseRate * 1.5;
  
  if (reportedOvertimeRate < requiredOvertimeRate) {
    finding = {
      check: "overtime_rate",
      severity: "critical",
      expected: requiredOvertimeRate,
      actual: reportedOvertimeRate,
      message: `Overtime must be 1.5x base rate (${requiredOvertimeRate})`
    };
  }
}
```

**Example:**
- Employee: Electrician, 45 hours
- Base rate: $38.50 (compliant)
- Overtime hours: 5
- Required overtime rate: $38.50 × 1.5 = $57.75
- Reported overtime rate: $38.50 (same as base)
- **Result:** ❌ VIOLATION - Severe underpayment of $22.25/hour on overtime

#### 3. Fringe Benefits Validation

**Logic:**
```typescript
// Total compensation must meet (base + fringe) × hours
requiredTotalCompensation = (prevailingBaseRate + prevailingFringe) * hours;
actualTotalCompensation = grossWages + fringeBenefitsPaid;

if (actualTotalCompensation < requiredTotalCompensation) {
  finding = {
    check: "fringe_benefits",
    severity: "error",
    expected: requiredTotalCompensation,
    actual: actualTotalCompensation,
    difference: actualTotalCompensation - requiredTotalCompensation
  };
}
```

**Fringe Benefit Payment Methods:**
1. **Contributions to plans** - Health, pension, etc.
2. **Cash in lieu** - Paid directly to worker
3. **Combination** - Some contributions + some cash

**Example:**
- Classification: Laborer
- Hours: 40
- Base rate paid: $24.51 (matches prevailing)
- Fringe paid: $15.00 cash
- Required fringe: $20.82
- **Result:** ❌ VIOLATION - Fringe underpayment of $5.82/hour

#### 4. Worker Classification Matching

**Challenge:** Job titles on payrolls don't always match DBWD classifications exactly.

**Common Mismatches:**
| Payroll Title | DBWD Classification | Match Confidence |
|---------------|---------------------|------------------|
| Wireman | Electrician | 95% |
| Helper | Laborer | 90% |
| Drywall Hanger | Carpenter (includes drywall) | 85% |
| Cement Finisher | Cement Mason/Concrete Finisher | 95% |
| Form Carpenter | Carpenter | 80% |

**Agent Logic:**
```typescript
// Exact match first
if (dbwdClassifications.includes(payrollTitle)) {
  classification = payrollTitle;
} else {
  // Query alias database + semantic similarity
  candidates = hybridSearch(payrollTitle, dbwdClassifications);
  
  if (candidates[0].score > 0.85) {
    classification = candidates[0].classification;
    note = `Mapped "${payrollTitle}" to "${classification}"`;
  } else {
    // Escalate for human review
    return { status: "REVISION_NEEDED", reason: "Ambiguous classification" };
  }
}
```

#### 5. Hours and Arithmetic Validation

**Checks:**
- Daily hours sum to weekly total
- Regular hours ≤ 40
- Overtime hours = max(0, total - 40)
- Gross wages = (regularHours × baseRate) + (overtimeHours × overtimeRate)

**Example - Arithmetic Error:**
```
Monday:     9 hours
Tuesday:    9 hours
Wednesday:  8 hours
Thursday:   9 hours
Friday:     9 hours
------------------
Sum:       43 hours (daily)
Reported:  40 hours (weekly total)  ← MISMATCH!
```

**Result:** ⚠️ REVISION_NEEDED - Data integrity error

---

## Real-World Validation Examples

### Example 1: Compliant Electrician

**Input (WH-347):**
```
Name: John Smith
Classification: Electrician
Hours: Mon=8, Tue=8, Wed=8, Thu=8, Fri=8, Sat=0, Sun=0
Total Hours: 40
Hourly Rate: $38.50
Gross Wages: $1,540.00
```

**DBWD Lookup:**
```
ELEC0490-002 06/01/2022
ELECTRICIAN
Basic Rate: $38.50
Fringe: $21.68
```

**Validation:**
- ✅ Base rate $38.50 ≥ $38.50 (prevailing)
- ✅ Hours ≤ 40 (no overtime required)
- ✅ Gross wages = 40 × $38.50 = $1,540.00 (correct)

**Decision:**
```json
{
  "status": "COMPLIANT",
  "explanation": "Wages meet Los Angeles prevailing rate for Electrician (ELEC0490-002). Base rate $38.50 matches required rate. No overtime hours.",
  "findings": [],
  "citations": ["ELEC0490-002 06/01/2022"],
  "confidence": 0.99
}
```

---

### Example 2: Violation - Underpayment + Overtime Error

**Input (WH-347):**
```
Name: Jane Doe
Classification: Electrician
Hours: Mon=9, Tue=9, Wed=9, Thu=9, Fri=9, Sat=0, Sun=0
Total Hours: 45
Hourly Rate: $35.50 (all hours)
Gross Wages: $1,597.50
```

**DBWD Lookup:**
```
ELEC0490-002 06/01/2022
ELECTRICIAN
Basic Rate: $38.50
Fringe: $21.68
Overtime: 1.5x base = $57.75
```

**Validation:**
- ❌ Base rate $35.50 < $38.50 (underpayment: $3.00/hr × 40 hrs = $120.00)
- ❌ Overtime hours: 5 hours over 40
- ❌ Overtime rate: $35.50 < $57.75 (underpayment: $22.25/hr × 5 hrs = $111.25)
- ❌ Total underpayment: $231.25

**Decision:**
```json
{
  "status": "VIOLATION",
  "explanation": "Multiple wage violations detected. Base rate is $3.00 below prevailing. Overtime rate is $22.25 below required 1.5x base. Total underpayment: $231.25 for this week.",
  "findings": [
    {
      "check": "base_wage",
      "severity": "error",
      "expected": 38.50,
      "actual": 35.50,
      "difference": -3.00,
      "impact": "$120.00 underpayment"
    },
    {
      "check": "overtime_rate",
      "severity": "critical",
      "expected": 57.75,
      "actual": 35.50,
      "difference": -22.25,
      "impact": "$111.25 underpayment"
    }
  ],
  "citations": ["ELEC0490-002 06/01/2022"],
  "confidence": 0.98
}
```

---

### Example 3: Job Title Resolution

**Input (WH-347):**
```
Name: Bob Wilson
Classification: Wireman
Hours: 40
Hourly Rate: $38.50
```

**DBWD Lookup:**
- "Wireman" not found in classifications
- Alias database: "Wireman" → "Electrician" (95% confidence)
- Hybrid search: "Electrician" score=0.88

**Validation:**
- ⚠️ Classification mapped: "Wireman" → "Electrician"
- ✅ Rate $38.50 matches Electrician prevailing rate

**Decision:**
```json
{
  "status": "COMPLIANT",
  "explanation": "Job title 'Wireman' resolved to 'Electrician' via trade alias mapping. Wage meets prevailing rate.",
  "findings": [
    {
      "check": "classification_mapping",
      "severity": "info",
      "input": "Wireman",
      "mapped": "Electrician",
      "confidence": 0.95
    }
  ],
  "citations": ["ELEC0490-002 06/01/2022", "Trade Alias Database"],
  "confidence": 0.92
}
```

---

## AI-Powered Validation Advantages

### 1. Automated Error Detection

**Traditional Process:**
- Manual review of hundreds of payrolls
- Hours of cross-referencing with wage determinations
- Human error in arithmetic checks

**AI Agent Process:**
- Instant parsing of payroll documents
- Automated DBWD lookup and matching
- Deterministic arithmetic validation
- Flags errors in milliseconds

### 2. Classification Intelligence

**Challenge:** Payroll titles vary widely
- "Wireman" vs "Electrician"
- "Cement Finisher" vs "Concrete Finisher"
- "Drywall Hanger" vs "Carpenter"

**Agent Solution:**
- Hybrid retrieval (BM25 + vector) for semantic matching
- Trade alias database for industry synonyms
- Confidence scoring for ambiguous matches
- Human escalation when uncertain

### 3. Predictive Risk Assessment

**AI Capabilities:**
- Pattern detection across multiple payrolls
- Flagging unusual wage combinations
- Predicting potential audit risks
- Trend analysis for ongoing compliance

### 4. Audit Trail and Replay

**For Regulators:**
- Every decision has unique trace ID
- Full request/response logging
- Replay capability months later
- Immutable decision records

---

## Compliance Statistics

### Industry Challenges

| Challenge | Frequency | Impact |
|-----------|-----------|--------|
| Worker misclassification | 15-20% of payrolls | Wage underpayment, penalties |
| Overtime calculation errors | 10-15% of payrolls | Back wages owed |
| Missing/incorrect fringe benefits | 20-25% of payrolls | Total compensation violations |
| Late submissions | 5-10% of projects | Payment withholding |

### Agent Target Performance

| Metric | Target | Industry Baseline |
|--------|--------|-------------------|
| Violation detection rate | >95% | 60-70% (manual review) |
| False approve rate | <2% | 5-10% (human error) |
| Processing time | <5 seconds | Hours to days |
| Classification accuracy | >90% | 70-80% (inexperienced staff) |

---

## References

### Official Sources

1. **U.S. Department of Labor - Form WH-347**
   - [Instructions](https://www.dol.gov/agencies/whd/forms/wh347)
   - [PDF Form](https://www.dol.gov/sites/dolgov/files/WHD/legacy/files/wh347.pdf)
   - [Online Fillable](https://www.dol.gov/agencies/whd/forms/wh347-web)

2. **Davis-Bacon Wage Determinations**
   - [SAM.gov Wage Determinations](https://sam.gov/content/wage-determinations)
   - [DOL Wage Determinations Guide](https://www.dol.gov/agencies/whd/government-contracts/prevailing-wage-resource-book/db-wage-determinations)

3. **Legal Cases**
   - *United States v. Clark* - Criminal conviction for falsified payrolls

### Industry Resources

- [Davis-Bacon Solutions - Compliance Blog](https://www.davisbaconsolutions.com/blog)
- [Whitcomb Law - Certified Payroll Guide](https://www.whitcomblawpc.com/articles/certified-payroll-davis-bacon-act)
- [eBacon - Davis-Bacon Basics](https://www.ebacon.com/davis-bacon/)

---

## Related Documentation

- [Case Study](../showcase/case-study.md) - Concrete validation examples
- [Deterministic Validation](../architecture/deterministic-validation.md) - Validation logic
- [Retrieval and Context](../architecture/retrieval-and-context.md) - DBWD lookup architecture
- [Data Model](../architecture/data-model.md) - WCP schema design
- [Evaluation Strategy](../evaluation/evaluation-strategy.md) - Testing approach

---

*Last updated: January 2024*
*Sources: U.S. Department of Labor, SAM.gov, industry compliance experts*
