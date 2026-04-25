# Davis-Bacon Act — Regulatory Compliance Report

**Scope:** WCP Compliance Agent V3 coverage of federal prevailing wage requirements.

---

## Statutory Framework

### Primary Authority

**Davis-Bacon Act** (40 U.S.C. §§ 3141–3148)
- Enacted 1931; administered by the Department of Labor (DOL) Wage and Hour Division
- Requires payment of locally prevailing wages to laborers and mechanics on federal construction contracts exceeding $2,000
- The "prevailing wage" is the Davis-Bacon Wage Determination (DBWD) for each trade and locality

### Implementing Regulations

| Regulation | Citation | Scope |
|---|---|---|
| Davis-Bacon regulations | 29 C.F.R. Part 5 | General compliance requirements, certified payroll, recordkeeping |
| Copeland "Anti-Kickback" Act | 29 C.F.R. Part 3 | Deduction restrictions, certification requirements |
| Contract Work Hours & Safety Standards Act (CWHSSA) | 29 C.F.R. § 5.32 | Overtime requirements for federally funded contracts |
| Fair Labor Standards Act (FLSA) | 29 U.S.C. §§ 201–219 | Federal minimum wage floor (sanity check) |

---

## WCP Compliance Agent — Coverage Map

### What the System Checks

| Requirement | Regulation | V3 Check | Status |
|---|---|---|---|
| Prevailing wage for each trade/locality | 40 U.S.C. § 3142 | `wage_check` | ✅ Implemented |
| Fringe benefits (cash or equivalent) | 40 U.S.C. § 3141(2)(B) | `fringe_check` | ✅ Implemented |
| Overtime at 1.5× for hours > 40/week | 29 C.F.R. § 5.32, 29 U.S.C. § 207 | `overtime_check` | ✅ Implemented |
| Certified payroll signature | 29 C.F.R. § 5.5(a)(3)(ii)(B), § 3.3 | `signature_check` | ✅ Implemented |
| Arithmetic integrity (net = gross − deductions) | 29 C.F.R. § 5.5(a)(3)(i) | `total_check` | ✅ Implemented |
| Correct trade classification | 29 C.F.R. § 5.5(a)(3)(i) | Layer 1 classification | ✅ Implemented |
| Federal minimum wage floor | 29 U.S.C. § 206(a)(1) | Layer 1 sanity check | ✅ Implemented |

### What the System Does Not Currently Check

| Requirement | Regulation | Reason Excluded |
|---|---|---|
| Apprentice/trainee ratios | 29 C.F.R. § 5.5(a)(4) | Requires contract-specific apprenticeship program data (V4 scope) |
| Debarment list check | 29 C.F.R. Part 5, Subpart C | Requires SAM.gov exclusions API integration (V4 scope) |
| Payroll record retention compliance | 29 C.F.R. § 5.5(a)(3)(ii) | Audit trail enforcement, not submission validation (enforced by audit_events table) |
| Subcontractor payroll verification | 40 U.S.C. § 3145 | Multi-document correlation (V4 scope) |

---

## Audit Trail Requirements

Davis-Bacon enforcement actions can look back **7 years**. The V3 audit trail satisfies:

| Requirement | Implementation |
|---|---|
| Immutable decision record | `decisions` table, INSERT-only, no UPDATE/DELETE |
| Full audit event log | `audit_events` table, append-only |
| Regulation citation on every finding | `regulation_cite` field in every `ComplianceCheck` |
| Trace ID linking LLM reasoning to decision | `phoenix_trace_id` in `TrustScoredDecision` |
| Human review documentation | `HumanReviewQueue` for trust_score < 0.60 decisions |

**Retention policy:** PostgreSQL operational logs retain 90 days. Parquet archives (V4) retain 7 years per DOL audit requirements.

---

## DBWD Rate Data

The Davis-Bacon Wage Determination (DBWD) system:
- Administered by DOL Wage and Hour Division
- Published by trade and geographic locality (county/city level)
- Updated periodically; contractors must use the rate in effect on the date of contract award

**V3 DBWD data sources (in priority order):**
1. **PostgreSQL `dbwd_rates` table** — seeded via `backend/scripts/seed_dbwd.py` and refreshed by `backend/scripts/etl_sam_gov.py`
2. **SAM.gov Wage Determinations API** — live fallback for missing rates
3. **In-memory corpus** — 20 trades/localities from `_archive/data/dbwd-corpus.json` — Phase 01 fallback only

**Important:** The in-memory corpus contains approximate rates for development/testing. Production deployments must seed from SAM.gov.

---

## Penalties for Non-Compliance

This context informs the trust score gating and human review queue thresholds:

| Violation | DOL Consequence | Contractor Risk |
|---|---|---|
| Underpayment of prevailing wage | Back wages + interest owed to worker | Payment withheld from contract |
| Pattern of violations | Debarment from federal contracts (3 years) | Loss of all federal contract eligibility |
| False certification | Criminal penalties (18 U.S.C. § 1001) | Individual liability for payroll officers |
| Non-submission of certified payroll | Withholding of contract payments | Project delay, contract default |

These stakes justify the V3 design choice of hard-fail CI regression on the golden set — a 5% drop in accuracy is not acceptable when violations carry debarment risk.
