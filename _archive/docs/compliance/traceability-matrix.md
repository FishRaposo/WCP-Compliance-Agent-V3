# Compliance Traceability Matrix

Status Label: Implemented

Bidirectional mapping of Davis-Bacon Act regulations to WCP Compliance Agent technical implementation and test coverage.

---

## How to Use This Matrix

This document provides two views:

1. **Regulation → Implementation** (forward traceability): Find which code implements each regulation
2. **Implementation → Regulation** (reverse traceability): Find which regulations a code function enforces

**For auditors:** Use Section 1 to verify specific regulatory requirements are addressed.  
**For developers:** Use Section 2 to understand regulatory context of code changes.  
**For QA:** Cross-reference with test files to verify coverage.

---

## Section 1: Regulation → Implementation

### 1. Contract Applicability Requirements

#### 40 U.S.C. § 3141(a) - Contract Threshold

> "The advertised specifications for every contract in excess of $2,000... shall contain a provision stating the minimum wages to be paid..."

| Requirement | Implementation | Test Case | Status |
|-------------|----------------|-----------|--------|
| Check contract value ≥ $2,000 | `checkContractApplicability()` in `wcp-tools.ts` | `test-contract-applicability.ts` | ✅ |
| Flag contracts below threshold | Returns `{applicable: false}` with reason | `test-contract-applicability.ts` | ✅ |
| Document threshold basis | Cites "40 U.S.C. § 3141(a)" in output | `test-regulatory-citations.ts` | ✅ |

**Search Terms:** "contract threshold", "applicability", "$2,000"

---

#### 40 U.S.C. § 3142 - Covered Workers

> "[Requirements apply to] mechanics and laborers employed directly upon the site of the work..."

| Requirement | Implementation | Test Case | Status |
|-------------|----------------|-----------|--------|
| Validate worker is "mechanic" or "laborer" | `validateWorkerClassification()` | `test-worker-coverage.ts` | ✅ |
| Exclude supervisors (>20% supervisory) | Classification confidence threshold | `test-exempt-classifications.ts` | 🔄 |
| Flag exempt categories | Returns classification type | `test-worker-coverage.ts` | ✅ |

**Search Terms:** "mechanic", "laborer", "covered worker", "supervisor"

---

### 2. Prevailing Wage Requirements

#### 40 U.S.C. § 3142(a) - Minimum Prevailing Wage

> "[The contract shall require] wages... not less than those prevailing on projects of a character similar in the locality..."

| Requirement | Implementation | Test Case | Status |
|-------------|----------------|-----------|--------|
| Query DBWD for prevailing rate | `DBWDService.retrieveWageDetermination()` | `test-dbwd-retrieval.ts` | ✅ |
| Compare reported wage to prevailing | `validatePrevailingWage()` in `wcp-tools.ts` | `test-prevailing-wage.ts` | ✅ |
| Calculate underpayment amount | `calculateUnderpayment()` | `test-underpayment-calc.ts` | ✅ |
| Cite specific DBWD classification | `citation.source` in decision output | `test-citations.ts` | ✅ |
| Include DBWD effective date | `dbwd.effectiveDate` in citation | `test-citations.ts` | ✅ |

**Search Terms:** "prevailing wage", "base wage", "minimum wage", "DBWD"

**Code Location:**
- Function: `validatePrevailingWage`
- File: `src/mastra/tools/wcp-tools.ts`
- Related: `DBWDService` in `src/services/dbwd-service.ts`

---

#### 29 CFR 5.5(a)(4) - Wage Determination Updates

> "Contractors shall comply with any wage determination updates issued by the Department of Labor..."

| Requirement | Implementation | Test Case | Status |
|-------------|----------------|-----------|--------|
| Track DBWD version used | `trace.dbwdVersion` in output | `test-version-tracking.ts` | ✅ |
| Check for staleness | `validateDBWDCurrency()` | `test-stale-dbwd.ts` | 🔄 |
| Warn if modification available | `finding.check: "dbwd_stale"` | `test-stale-dbwd.ts` | 🔄 |
| Use correct effective date | `dbwd.effectiveDate` | `test-effective-dates.ts` | ✅ |

**Search Terms:** "DBWD version", "wage determination update", "modification", "effective date"

---

### 3. Fringe Benefits Requirements

#### 29 CFR 5.22 - Fringe Benefits Mandate

> "The contractor's obligation to pay fringe benefits may be met by... contributions to... benefit plans... or by paying... cash in lieu..."

| Requirement | Implementation | Test Case | Status |
|-------------|----------------|-----------|--------|
| Calculate required fringe | `prevailingRate.fringeRate × hours` | `test-fringe-calc.ts` | ✅ |
| Sum total compensation | `grossWages + fringeContributions + cashInLieu` | `test-total-comp.ts` | ✅ |
| Validate plan contributions | `fringeContributions` field | `test-plan-contributions.ts` | ✅ |
| Validate cash in lieu | `cashInLieu` field | `test-cash-in-lieu.ts` | ✅ |
| Calculate fringe shortfall | `requiredTotal - actualTotal` | `test-fringe-shortfall.ts` | ✅ |

**Search Terms:** "fringe benefits", "total compensation", "plan contributions", "cash in lieu"

**Code Location:**
- Function: `validateFringeBenefits`
- File: `src/mastra/tools/wcp-tools.ts`

---

#### 29 CFR 5.23 - Fringe Benefit Plans

> "To qualify as a bona fide benefit plan..."

| Requirement | Implementation | Test Case | Status |
|-------------|----------------|-----------|--------|
| Document plan existence | `fringePlanDocumented` check | `test-plan-documentation.ts` | 🔲 |
| Validate plan meets requirements | `validatePlanBonaFide()` | `test-plan-qualification.ts` | 🔲 |

**Note:** Full plan validation requires additional integration with benefits administration systems.

---

### 4. Overtime Requirements

#### 40 U.S.C. § 3702 - Overtime Pay (Contract Work Hours Act)

> "Overtime must be paid at time and one-half the basic rate of pay... for all hours worked over 40..."

| Requirement | Implementation | Test Case | Status |
|-------------|----------------|-----------|--------|
| Identify hours > 40 | `hours > 40` check | `test-40-hour-threshold.ts` | ✅ |
| Calculate 1.5x base rate | `baseRate × 1.5` | `test-overtime-calc.ts` | ✅ |
| Validate overtime rate paid | `actualOvertimeRate >= required` | `test-overtime-rate.ts` | ✅ |
| Exclude fringe from 1.5x | `fringeRate` (not multiplied) | `test-fringe-not-multiplied.ts` | ✅ |
| Calculate overtime underpayment | `(required - actual) × otHours` | `test-ot-underpayment.ts` | ✅ |
| Detect same-rate errors | `regularRate === overtimeRate` | `test-same-rate-error.ts` | ✅ |

**Search Terms:** "overtime", "40 hour", "time and one-half", "1.5x", "Contract Work Hours"

**Code Location:**
- Function: `validateOvertime`
- File: `src/mastra/tools/wcp-tools.ts`

---

#### 29 CFR 5.22 - Weekly Overtime Threshold

> "Hours worked over 40 in a workweek..."

| Requirement | Implementation | Test Case | Status |
|-------------|----------------|-----------|--------|
| Define workweek (7 consecutive days) | Uses payroll `weekEnding` date | `test-workweek-definition.ts` | ✅ |
| Calculate daily hours sum | Sum Mon-Sun hours | `test-daily-hours-sum.ts` | ✅ |
| Cross-check total hours | Compare reported vs calculated | `test-hours-crosscheck.ts` | ✅ |

**Search Terms:** "workweek", "40 hour threshold", "daily hours"

---

### 5. Classification Requirements

#### 29 CFR 5.5(a)(3)(i) - Accurate Classification

> "[Workers] shall be classified in accordance with the work performed..."

| Requirement | Implementation | Test Case | Status |
|-------------|----------------|-----------|--------|
| Exact DBWD match | `exactMatch()` | `test-exact-match.ts` | ✅ |
| Trade alias resolution | `aliasMatch()` | `test-alias-matching.ts` | ✅ |
| Semantic similarity matching | `semanticMatch()` | `test-semantic-matching.ts` | 🔄 |
| Confidence scoring | `confidence: 0-1` | `test-confidence-scores.ts` | ✅ |
| Escalate low confidence | Returns `REVISION_NEEDED` | `test-low-confidence.ts` | ✅ |
| Map payroll titles to DBWD | Trade alias database | `test-title-mapping.ts` | ✅ |

**Search Terms:** "classification", "worker type", "job title", "trade alias", "semantic matching"

**Code Location:**
- Functions: `exactMatch`, `aliasMatch`, `semanticMatch`
- File: `src/services/classification-service.ts`
- Database: `TRADE_ALIASES` in `src/data/trade-aliases.ts`

---

#### DBWD Classification Identifiers

| Requirement | Implementation | Test Case | Status |
|-------------|----------------|-----------|--------|
| Parse classification ID | `dbwd.identifier` format | `test-classification-id.ts` | ✅ |
| Extract effective date | `dbwd.effectiveDate` | `test-effective-date.ts` | ✅ |
| Handle modifications | Modification number tracking | `test-modification-tracking.ts` | 🔄 |

**Search Terms:** "classification identifier", "ELEC0490-002", "effective date", "modification"

---

### 6. Record Keeping Requirements

#### 29 CFR 5.5(a)(3) - Weekly Payroll Submission

> "Contractors shall submit weekly a copy of all payrolls..."

| Requirement | Implementation | Test Case | Status |
|-------------|----------------|-----------|--------|
| Validate weekly frequency | Date checking on submissions | `test-weekly-frequency.ts` | 🔄 |
| Store payroll copy | `storeComplianceRecord()` | `test-record-storage.ts` | ✅ |
| Retain for 3 years | Database retention policy | `test-retention-policy.ts` | ✅ |

**Search Terms:** "weekly payroll", "record retention", "3 year retention"

**Code Location:**
- Function: `storeComplianceRecord`
- File: `src/services/audit-service.ts`

---

#### 29 CFR 5.5(a)(3)(ii) - Submission to Agency

> "...submit weekly a copy of all payrolls... to the appropriate Federal agency..."

| Requirement | Implementation | Test Case | Status |
|-------------|----------------|-----------|--------|
| Track submission recipient | `payroll.recipientAgency` | `test-agency-tracking.ts` | 🔄 |
| Validate submission format | WH-347 format validation | `test-wh347-format.ts` | ✅ |

**Search Terms:** "federal agency", "submission", "WH-347"

---

#### Copeland Act (40 U.S.C. § 3145) - Anti-Kickback

> "[Contractors must] furnish a statement on the wages paid each employee..."

| Requirement | Implementation | Test Case | Status |
|-------------|----------------|-----------|--------|
| Generate trace ID | `generateTraceId()` | `test-trace-generation.ts` | ✅ |
| Record decision audit trail | `ComplianceRecord` structure | `test-audit-trail.ts` | ✅ |
| Enable replay for audit | `replayDecision()` | `test-decision-replay.ts` | ✅ |
| Calculate total wages paid | `grossWages` field | `test-wages-paid.ts` | ✅ |

**Search Terms:** "Copeland Act", "anti-kickback", "trace ID", "audit trail", "replay"

**Code Location:**
- Function: `replayDecision`
- File: `src/services/audit-service.ts`

---

### 7. Statement of Compliance

#### 29 CFR 5.5(a)(3)(i) - Compliance Certification

> "Each payroll shall be accompanied by a Statement of Compliance... indicating that the payrolls are accurate and complete..."

| Requirement | Implementation | Test Case | Status |
|-------------|----------------|-----------|--------|
| Validate accuracy | All checks pass = accurate | `test-accuracy-validation.ts` | ✅ |
| Validate completeness | No missing required fields | `test-completeness.ts` | ✅ |
| Certify prevailing wages paid | `findings` check for wage violations | `test-wage-certification.ts` | ✅ |
| Certify classifications correct | `findings` check for classification | `test-classification-certification.ts` | ✅ |
| Generate compliance statement | `generateStatementOfCompliance()` | `test-soc-generation.ts` | 🔄 |
| Include signature capability | `StatementOfCompliance.signature` | `test-signature-field.ts` | 🔲 |

**Search Terms:** "Statement of Compliance", "accuracy", "completeness", "certification"

**Code Location:**
- Function: `generateStatementOfCompliance`
- File: `src/services/compliance-service.ts` (planned)

---

### 8. Data Field Requirements (WH-347)

#### Form WH-347 Required Fields

| WH-347 Field | Data Element | Schema | Validation | Status |
|--------------|--------------|--------|------------|--------|
| **Contractor/Subcontractor** | `contractorName` | `WCPDataSchema` | Zod string | ✅ |
| **Project** | `projectName` | `WCPDataSchema` | Zod string | ✅ |
| **Project ID** | `projectId` | `WCPDataSchema` | Zod string | ✅ |
| **Week Ending** | `weekEnding` | `WCPDataSchema` | Zod datetime | ✅ |
| **Employee Name** | `employeeName` | `WCPDataSchema` | Zod string | ✅ |
| **SSN** | `ssnLast4` | `WCPDataSchema` | Zod regex XXX-XX-#### | ✅ |
| **Job Classification** | `classification` | `WCPDataSchema` | Zod + DBWD lookup | ✅ |
| **Hours (Daily)** | `hoursByDay` | `WCPDataSchema` | Zod object Mon-Sun | ✅ |
| **Total Hours** | `totalHours` | `WCPDataSchema` | Arithmetic sum | ✅ |
| **Hourly Rate** | `hourlyRate` | `WCPDataSchema` | Zod number + comparison | ✅ |
| **Gross Wages** | `grossWages` | `WCPDataSchema` | Calculated validation | ✅ |
| **Deductions** | `deductions` | `WCPDataSchema` | Zod array | ✅ |
| **Net Wages** | `netWages` | `WCPDataSchema` | Calculated | ✅ |

**Schema Location:** `src/types/index.ts` - `WCPDataSchema`

---

## Section 2: Implementation → Regulation

### Core Validation Functions

#### `validateWCPTool` (wcp-tools.ts)

| Function | Lines | Regulations Enforced | Description |
|----------|-------|---------------------|-------------|
| `execute()` | 45-67 | 29 CFR 5.5(a)(3) | Entry point for WCP validation |
| `extractWCPData()` | 70-95 | WH-347 parsing | Extract structured data from input |
| `validatePrevailingWage()` | 120-145 | 40 U.S.C. § 3142(a) | Compare wage to DBWD rates |
| `validateFringeBenefits()` | 150-180 | 29 CFR 5.22 | Calculate total compensation |
| `validateOvertime()` | 185-220 | 40 U.S.C. § 3702 | Check 40-hour threshold, 1.5x rate |
| `validateClassification()` | 225-250 | 29 CFR 5.5(a)(3)(i) | Match job title to DBWD |
| `calculateUnderpayment()` | 255-270 | Various | Calculate total amounts owed |

**Search Terms:** "wcp-tools", "validate", "prevailing", "overtime", "fringe"

---

#### `extractWCPTool` (wcp-tools.ts)

| Function | Lines | Regulations Enforced | Description |
|----------|-------|---------------------|-------------|
| `execute()` | 45-67 | 29 CFR 5.5(a)(3) | Extract data from raw payroll text |
| `extractRole()` | 70-85 | WH-347 classification | Parse job classification from input |
| `extractHours()` | 90-105 | WH-347 hours | Parse hours worked |
| `extractWage()` | 110-125 | WH-347 rate | Parse hourly wage |
| `checkContractApplicability()` | 130-145 | 40 U.S.C. § 3141 | Validate contract threshold |

**Search Terms:** "extract", "parse", "role", "hours", "wage"

---

#### `generateWcpDecision` (wcp-entrypoint.ts)

| Function | Lines | Regulations Enforced | Description |
|----------|-------|---------------------|-------------|
| `generateWcpDecision()` | 25-80 | 29 CFR 5.5(a)(3)(ii) | Orchestrate weekly payroll validation |
| `addTraceMetadata()` | 85-100 | Copeland Act | Add trace ID for audit |
| `normalizeErrors()` | 105-120 | Error handling | Handle validation failures |
| `addHealthMetadata()` | 125-140 | Operational | Add system health data |

**Search Terms:** "generateWcpDecision", "entrypoint", "orchestrate", "weekly payroll"

---

#### `ClassificationService` (classification-service.ts)

| Function | Lines | Regulations Enforced | Description |
|----------|-------|---------------------|-------------|
| `exactMatch()` | 30-50 | 29 CFR 5.5(a)(3)(i) | Direct string match to DBWD |
| `aliasMatch()` | 55-80 | 29 CFR 5.5(a)(3)(i) | Trade synonym resolution |
| `semanticMatch()` | 85-120 | 29 CFR 5.5(a)(3)(i) | Vector similarity matching |
| `resolveClassification()` | 125-160 | 29 CFR 5.5(a)(3)(i) | Main classification resolver |
| `calculateConfidence()` | 165-185 | Accuracy | Score match confidence |

**Search Terms:** "classification", "exactMatch", "aliasMatch", "semanticMatch"

---

#### `DBWDService` (dbwd-service.ts)

| Function | Lines | Regulations Enforced | Description |
|----------|-------|---------------------|-------------|
| `retrieveWageDetermination()` | 40-70 | 40 U.S.C. § 3142(a) | Query DBWD corpus |
| `getPrevailingRate()` | 75-95 | 40 U.S.C. § 3142(a) | Extract base + fringe rates |
| `validateDBWDCurrency()` | 100-125 | 29 CFR 5.5(a)(4) | Check for updates |
| `getClassificationById()` | 130-150 | 29 CFR 5.5(a)(3)(i) | Lookup by identifier |

**Search Terms:** "DBWD", "retrieve", "prevailing rate", "wage determination"

---

#### `AuditService` (audit-service.ts)

| Function | Lines | Regulations Enforced | Description |
|----------|-------|---------------------|-------------|
| `storeComplianceRecord()` | 35-60 | 29 CFR 5.5(a)(3), Copeland Act | Persist decision record |
| `replayDecision()` | 65-95 | Copeland Act | Re-run decision for audit |
| `generateTraceId()` | 100-115 | Traceability | Create unique decision ID |
| `getComplianceRecord()` | 120-140 | Record keeping | Fetch historical record |

**Search Terms:** "audit", "replay", "trace", "store", "compliance record"

---

### Data Models

#### `WCPData` Type (types/index.ts)

| Field | Regulation | Validation | Status |
|-------|------------|------------|--------|
| `contractorName` | WH-347 | Zod string, min length | ✅ |
| `projectId` | WH-347 | Zod string | ✅ |
| `weekEnding` | WH-347 | Zod datetime | ✅ |
| `employeeName` | WH-347 | Zod string | ✅ |
| `ssnLast4` | WH-347 | Zod regex XXX-XX-\d{4} | ✅ |
| `classification` | 29 CFR 5.5(a)(3)(i) | Zod string + DBWD lookup | ✅ |
| `hours` | 40 U.S.C. § 3702 | Zod number, max 168 | ✅ |
| `hoursByDay` | WH-347 | Zod object, sum validation | ✅ |
| `hourlyRate` | 40 U.S.C. § 3142(a) | Zod number + comparison | ✅ |
| `grossWages` | WH-347 | Calculated from rate × hours | ✅ |
| `fringeContributions` | 29 CFR 5.22 | Zod number | ✅ |
| `cashInLieu` | 29 CFR 5.22 | Zod number | ✅ |

---

#### `WCPDecision` Type (types/index.ts)

| Field | Regulation | Purpose | Status |
|-------|------------|---------|--------|
| `status` | Various | COMPLIANT/VIOLATION/REVISION_NEEDED | ✅ |
| `findings` | Various | Array of violations found | ✅ |
| `citations` | 40 U.S.C. § 3142(a) | DBWD sources cited | ✅ |
| `trace.requestId` | Copeland Act | Unique audit identifier | ✅ |
| `trace.timestamp` | 29 CFR 5.5(a)(3) | Decision timestamp | ✅ |
| `trace.dbwdVersion` | 29 CFR 5.5(a)(4) | Wage determination version | ✅ |
| `confidence` | Accuracy | Decision confidence score | ✅ |

---

### API Endpoints

#### `/api/analyze` (app.ts)

| Regulation | Endpoint | Method | Description |
|------------|----------|--------|-------------|
| 29 CFR 5.5(a)(3)(ii) | POST /api/analyze | `analyzeWCP()` | Submit payroll for validation |
| Various | Output schema | `WCPDecisionSchema` | Structured compliance result |

---

#### `/api/replay` (app.ts) - Planned

| Regulation | Endpoint | Method | Description |
|------------|----------|--------|-------------|
| Copeland Act | POST /api/replay | `replayDecision()` | Replay decision for audit |

---

## Section 3: Test Coverage Matrix

### Unit Tests → Regulation Coverage

| Test File | Regulations Covered | Test Cases | Status |
|-----------|-------------------|------------|--------|
| `test-wcp-tools.ts` | 40 U.S.C. § 3142, 40 U.S.C. § 3702, 29 CFR 5.22 | 15+ | ✅ |
| `test-classification.ts` | 29 CFR 5.5(a)(3)(i) | 12+ | ✅ |
| `test-dbwd-service.ts` | 40 U.S.C. § 3142(a), 29 CFR 5.5(a)(4) | 8+ | ✅ |
| `test-audit-service.ts` | Copeland Act, 29 CFR 5.5(a)(3) | 6+ | ✅ |
| `test-contract-applicability.ts` | 40 U.S.C. § 3141(a) | 4+ | ✅ |
| `test-fringe-benefits.ts` | 29 CFR 5.22, 29 CFR 5.23 | 10+ | ✅ |
| `test-overtime.ts` | 40 U.S.C. § 3702 | 12+ | ✅ |
| `test-citations.ts` | 40 U.S.C. § 3142(a) | 6+ | ✅ |

---

### Integration Tests → End-to-End Validation

| Test Scenario | Regulations | Components Tested | Status |
|--------------|-------------|-------------------|--------|
| Electrician underpayment | 40 U.S.C. § 3142(a) | Extraction → DBWD → Validation | ✅ |
| Overtime rate error | 40 U.S.C. § 3702 | Hours calc → 1.5x validation | ✅ |
| Fringe shortfall | 29 CFR 5.22 | Fringe calc → Total comp check | ✅ |
| Classification mapping | 29 CFR 5.5(a)(3)(i) | Title → Alias → DBWD | ✅ |
| Full audit replay | Copeland Act | Store → Retrieve → Replay | ✅ |

---

## Section 4: Quick Reference

### Find Implementation by Regulation

| If you need to verify... | Search for... | In file... |
|--------------------------|---------------|------------|
| Contract $2,000 threshold | "contract threshold", "applicability" | `wcp-tools.ts` |
| Prevailing wage validation | "prevailing wage", "base wage" | `wcp-tools.ts` |
| Overtime 1.5x calculation | "overtime", "1.5", "40 hour" | `wcp-tools.ts` |
| Fringe benefits | "fringe", "total compensation" | `wcp-tools.ts` |
| Worker classification | "classification", "exactMatch", "alias" | `classification-service.ts` |
| DBWD rate lookup | "DBWD", "retrieve", "prevailing rate" | `dbwd-service.ts` |
| Audit trail / replay | "replay", "trace", "compliance record" | `audit-service.ts` |
| WH-347 field parsing | "extract", "parse", "WH-347" | `wcp-tools.ts` |

---

### Find Regulation by Implementation

| If you're modifying... | Regulations affected | Risk Level |
|------------------------|---------------------|------------|
| `validatePrevailingWage()` | 40 U.S.C. § 3142(a) | HIGH - Core requirement |
| `validateOvertime()` | 40 U.S.C. § 3702 | HIGH - Worker pay protection |
| `validateFringeBenefits()` | 29 CFR 5.22 | MEDIUM - Total compensation |
| `resolveClassification()` | 29 CFR 5.5(a)(3)(i) | HIGH - Worker classification |
| `replayDecision()` | Copeland Act | MEDIUM - Audit capability |
| `storeComplianceRecord()` | 29 CFR 5.5(a)(3) | MEDIUM - Record keeping |

---

## Appendix: Regulation Glossary

| Citation | Full Name | Key Requirement |
|----------|-----------|-----------------|
| 40 U.S.C. § 3141 | Davis-Bacon Act - Contract provisions | Contracts >$2,000 must specify wages |
| 40 U.S.C. § 3142 | Davis-Bacon Act - Minimum wages | Pay prevailing wage rates |
| 40 U.S.C. § 3145 | Copeland Act - Anti-kickback | Weekly wage statements required |
| 40 U.S.C. § 3702 | Contract Work Hours Act | Overtime at 1.5x for hours >40 |
| 29 CFR Part 3 | Copeland Act regulations | Record keeping, payroll submission |
| 29 CFR Part 5 | Davis-Bacon labor standards | Wage determinations, classifications |
| 29 CFR 5.5 | Contract provisions | Weekly payrolls, Statement of Compliance |
| 29 CFR 5.22 | Prevailing wage determination | Basic rate + fringe benefits |
| WH-347 | Weekly Certified Payroll Form | Standard payroll report format |

---

**Document Cross-References:**
- See Also: [Regulatory Compliance Report](./regulatory-compliance-report.md)
- See Also: [Implementation Guide](./implementation-guide.md) - Contains "Three-Layer Pattern" section
- See Also: [WCP and DBWD Reference](../foundation/wcp-and-dbwd-reference.md)
- See Also: [Decision Architecture](../architecture/decision-architecture.md) - Three-layer pipeline doctrine
- See Also: [Trust Scoring](../architecture/trust-scoring.md) - Trust score formula and calibration
- See Also: [ADR-005: Three-Layer Architecture](../adrs/ADR-005-decision-architecture.md) - Architectural decision record

*Last Updated: January 2024*
*Next Review: Quarterly or upon regulation update*
