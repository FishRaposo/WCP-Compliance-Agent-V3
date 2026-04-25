# Regulation → Check Traceability Matrix

Maps every compliance check in the V3 rule engine to its statutory authority. Every failed check produces a `regulation_cite` field in `ComplianceCheck` that references one of these citations — this is what makes audit trails legally defensible.

## Check → Regulation Mapping

| Check ID | Check Type | Regulation | Citation | Requirement |
|---|---|---|---|---|
| `wage_check` | `CheckType.WAGE` | Davis-Bacon Act | 40 U.S.C. § 3142 | Employee hourly rate ≥ applicable prevailing wage rate |
| `fringe_check` | `CheckType.FRINGE` | Davis-Bacon Act | 40 U.S.C. § 3141(2)(B) | Fringe benefits ≥ required fringe rate × hours worked |
| `overtime_check` | `CheckType.OVERTIME` | Contract Work Hours & Safety Standards Act | 29 C.F.R. § 5.32 | Hours > 40/week paid at ≥ 1.5× base rate |
| `overtime_check` | `CheckType.OVERTIME` | Fair Labor Standards Act | 29 U.S.C. § 207(a)(1) | Sanity floor: overtime must exceed regular time rate |
| `signature_check` | `CheckType.SIGNATURE` | Davis-Bacon regulations | 29 C.F.R. § 5.5(a)(3)(ii)(B) | Certified payroll must be signed under penalty of perjury |
| `signature_check` | `CheckType.SIGNATURE` | Davis-Bacon regulations | 29 C.F.R. § 3.3 | Certification statement must be present |
| `total_check` | `CheckType.TOTAL` | Davis-Bacon regulations | 29 C.F.R. § 5.5(a)(3)(i) | Net wages = gross earnings − deductions (± $0.02 tolerance) |
| `classification_check` | _(Layer 1 only)_ | Davis-Bacon regulations | 29 C.F.R. § 5.5(a)(3)(i) | Worker classification must match applicable wage determination |
| `minimum_wage_check` | _(Layer 1 sanity)_ | Fair Labor Standards Act | 29 U.S.C. § 206(a)(1) | No rate can be below federal minimum wage ($7.25/hr) |
| `data_integrity_check` | _(Layer 1 sanity)_ | Certified payroll requirement | 29 C.F.R. § 5.5(a)(3)(ii) | No negative wages, zero hours with non-zero wage, etc. |

## V3 Implementation Locations

| Check | Python module | Archive reference |
|---|---|---|
| `wage_check` | `backend/src/wcp_backend/pipeline/checks/wage_check.py` | `_archive/src/pipeline/layer1-deterministic.ts` → `checkPrevailingWage()` |
| `fringe_check` | `backend/src/wcp_backend/pipeline/checks/fringe_check.py` | `_archive/src/pipeline/layer1-deterministic.ts` → `checkFringeBenefits()` |
| `overtime_check` | `backend/src/wcp_backend/pipeline/checks/overtime_check.py` | `_archive/src/pipeline/layer1-deterministic.ts` → `checkOvertimeCompliance()` |
| `signature_check` | `backend/src/wcp_backend/pipeline/checks/signature_check.py` | `_archive/src/pipeline/layer1-deterministic.ts` → `checkSignature()` |
| `total_check` | `backend/src/wcp_backend/pipeline/checks/total_check.py` | `_archive/src/pipeline/layer1-deterministic.ts` → `checkTotalHours()` |

## Violation Severity

When the rule engine produces a `DeterministicReport`, each check has a severity that feeds into the trust score computation:

| Severity | Examples | Effect on trust score |
|---|---|---|
| **Critical** | `wage_check` failure, `fringe_check` failure | `deterministic_score = 0.0` regardless of other checks |
| **Error** | `overtime_check` failure, `total_check` arithmetic error | Reduces `deterministic_score` proportionally |
| **Warning** | `signature_check` — date present but unsigned | Does not block auto-approval; noted in audit trail |

Reference: `_archive/src/pipeline/layer3-trust-score.ts` → `computeAgreement()` for the V2 implementation of severity-weighted agreement scoring.

## Human Review Triggers

A decision routes to the human review queue when `trust_score < 0.60`. The most common causes:

1. LLM verdict disagrees with deterministic findings (low agreement score)
2. Critical violation detected but LLM confidence is high (possible LLM hallucination)
3. Classification confidence low (unknown trade classification)
4. Extraction produced partial data (missing required fields)

Reference: `_archive/src/pipeline/layer3-trust-score.ts` → `determineTrustBand()`.
