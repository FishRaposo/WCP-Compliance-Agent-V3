/**
 * Layer 1: Deterministic Scaffold
 *
 * Produces a DeterministicReport containing all objectively verifiable facts
 * about a WCP submission. NO AI. Pure deterministic code. 100% reproducible.
 *
 * Responsibilities:
 * - Extract structured data from WCP input
 * - Look up DBWD rates
 * - Run all rule checks (prevailing wage, overtime, fringe, classification)
 * - Produce DeterministicReport with regulation citations
 *
 * @see docs/architecture/decision-architecture.md - Layer 1 documentation
 * @see docs/adrs/ADR-005-decision-architecture.md - Architectural decision
 */

import {
  type DeterministicReport,
  type CheckResult,
  type ExtractedWCP,
  type ExtractedEmployee,
  type DBWDRateInfo,
} from "../types/decision-pipeline.js";
import { lookupRate, fuzzyMatchTrade } from "../services/dbwd-retrieval.js";
import { childLogger } from "../utils/logger.js";

const log = childLogger("Layer1");

// ============================================================================
// DBWD Rate Database — Deprecated inline table
// Kept only as last-resort fallback inside hybrid-retriever.ts.
// Layer 1 now delegates all lookups to the hybrid retrieval pipeline.
// ============================================================================

// ============================================================================
// Extraction Tool (Mastra-compatible)
// ============================================================================

/**
 * Extract WCP Data Tool
 *
 * Deterministic extraction of structured fields from WCP text input.
 * Uses regex patterns - NO LLM involved.
 *
 * Regulatory Basis:
 * - 29 CFR 5.5(a)(3)(ii): "Contractors shall submit weekly a copy of all payrolls..."
 * - Form WH-347: Standard format for certified payrolls
 */
export async function extractWCPData(content: string): Promise<ExtractedWCP> {
    const startTime = Date.now();

    // Core pattern-based extraction (deterministic, NO LLM)
    const roleMatch = content.match(/(?:Role|Classification|Trade|Position)[\s:]+([A-Za-z\s]+?)(?:,|;|\n|$)/i);
    const hoursMatch = content.match(/(?:Total\s+)?(?:Hours|Hrs)[\s:]+(\d+(?:\.\d+)?)/i);
    const wageMatch = content.match(/(?:Wage|Rate|Pay|Hourly)[\s:]+\$?(\d+(?:\.\d+)?)/i);
    const fringeMatch = content.match(/(?:Fringe|Benefits|Ben)[\s:]+\$?(\d+(?:\.\d+)?)/i);

    // Extended field extraction
    const workerNameMatch = content.match(/(?:Name|Worker|Employee)[\s:]+([A-Za-z,\s]+?)(?:,|;|\n|$)/i);
    const weekEndingMatch = content.match(/(?:Week\s+Ending|Week-Ending|WE)[\s:]+(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})/i);
    const projectIdMatch = content.match(/(?:Project|Contract|Job)[\s#:]+([A-Za-z0-9\-]+)/i);
    const localityMatch = content.match(/(?:Locality|Location|Area)[\s:]+([A-Za-z\s,]+?)(?:,|;|\n|$)/i);
    const ssnMatch = content.match(/(?:SSN|SS#|Social)[\s:]+(?:\*+|X+)(\d{4})/i);
    const grossPayMatch = content.match(/(?:Gross\s+Pay|Gross|Total\s+Pay)[\s:]+\$?(\d+(?:\.\d+)?)/i);

    // Day-by-day hours (e.g. "Mon: 8, Tue: 8, Wed: 8, Thu: 8, Fri: 8")
    const dayPatterns: Record<string, RegExp> = {
      mon: /(?:Mon(?:day)?)[\.\s:]+(\d+(?:\.\d+)?)/i,
      tue: /(?:Tue(?:sday)?)[\.\s:]+(\d+(?:\.\d+)?)/i,
      wed: /(?:Wed(?:nesday)?)[\.\s:]+(\d+(?:\.\d+)?)/i,
      thu: /(?:Thu(?:rsday)?)[\.\s:]+(\d+(?:\.\d+)?)/i,
      fri: /(?:Fri(?:day)?)[\.\s:]+(\d+(?:\.\d+)?)/i,
      sat: /(?:Sat(?:urday)?)[\.\s:]+(\d+(?:\.\d+)?)/i,
      sun: /(?:Sun(?:day)?)[\.\s:]+(\d+(?:\.\d+)?)/i,
    };

    // Extended WH-347 field extraction
    const subcontractorMatch = content.match(/(?:Subcontractor|Sub(?:contractor)?)[\.\s:]+([A-Za-z0-9\s,\.&'-]+?)(?:,|;|\n|$)/i);
    const weekStartMatch = content.match(/(?:Week\s+Start|WS|Pay\s+Period\s+Start)[\.\s:]+(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})/i);
    const reportedBaseRateMatch = content.match(/(?:Reported\s+Base|Base\s+Rate|Straight\s+Time\s+Rate)[\.\s:]+\$?(\d+(?:\.\d+)?)/i);
    const reportedFringeRateMatch = content.match(/(?:Reported\s+Fringe|Fringe\s+Rate|Benefit\s+Rate)[\.\s:]+\$?(\d+(?:\.\d+)?)/i);
    const reportedTotalPayMatch = content.match(/(?:Reported\s+Total|Total\s+(?:Comp(?:ensation)?|Package))[\.\s:]+\$?(\d+(?:\.\d+)?)/i);
    const signaturesMatch = content.match(/(?:Signed|Signature[s]?|Certified\s+by)[\.\s:]+([A-Za-z\s,]+?)(?:;|\n{2}|Date:|$)/i);

    const hoursByDay: ExtractedWCP["hoursByDay"] = {};
    let hasDayHours = false;
    for (const [day, pattern] of Object.entries(dayPatterns)) {
      const m = content.match(pattern);
      if (m) {
        (hoursByDay as Record<string, number>)[day] = parseFloat(m[1]);
        hasDayHours = true;
      }
    }

    const hours = hoursMatch ? parseFloat(hoursMatch[1]) : 0;
    const regularHours = Math.min(hours, 40);
    const overtimeHours = Math.max(0, hours - 40);
    const wage = wageMatch ? parseFloat(wageMatch[1]) : 0;

    const parsedSignatures: string[] | undefined = signaturesMatch
      ? signaturesMatch[1].split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;

    const result: ExtractedWCP = {
      rawInput: content,
      workerName: workerNameMatch ? workerNameMatch[1].trim() : undefined,
      socialSecurityLast4: ssnMatch ? ssnMatch[1] : undefined,
      role: roleMatch ? roleMatch[1].trim() : "Unknown",
      localityCode: localityMatch ? localityMatch[1].trim() : undefined,
      hours,
      regularHours,
      overtimeHours,
      hoursByDay: hasDayHours ? hoursByDay : undefined,
      wage,
      fringe: fringeMatch ? parseFloat(fringeMatch[1]) : undefined,
      grossPay: grossPayMatch ? parseFloat(grossPayMatch[1]) : undefined,
      weekEnding: weekEndingMatch ? weekEndingMatch[1] : undefined,
      weekStart: weekStartMatch ? weekStartMatch[1] : undefined,
      projectId: projectIdMatch ? projectIdMatch[1] : undefined,
      subcontractor: subcontractorMatch ? subcontractorMatch[1].trim() : undefined,
      reportedBaseRate: reportedBaseRateMatch ? parseFloat(reportedBaseRateMatch[1]) : undefined,
      reportedFringeRate: reportedFringeRateMatch ? parseFloat(reportedFringeRateMatch[1]) : undefined,
      reportedTotalPay: reportedTotalPayMatch ? parseFloat(reportedTotalPayMatch[1]) : undefined,
      signatures: parsedSignatures,
    };

    log.debug({ ms: Date.now() - startTime }, "Extraction completed");
    return result;
}

// ============================================================================
// Classification Resolution
// ============================================================================

/**
 * Classification Result with confidence and method
 */
interface ClassificationResult {
  trade: string;
  confidence: number;
  method: "exact" | "alias" | "semantic" | "manual" | "unknown";
}

/**
 * Resolve classification via JSON-based retrieval pipeline.
 *
 * Tier 1: Exact match via lookupRate
 * Tier 2: Fuzzy/alias match via fuzzyMatchTrade
 * Tier 3: Unknown
 *
 * @param role Role string from WCP
 * @returns Classification result with confidence
 */
async function resolveClassification(role: string): Promise<ClassificationResult> {
  // Tier 1: Exact match
  const exact = lookupRate(role);
  if (exact) {
    return { trade: exact.trade, confidence: 1.0, method: "exact" };
  }

  // Tier 2: Fuzzy / alias match
  const fuzzy = fuzzyMatchTrade(role);
  if (fuzzy !== role) {
    const rate = lookupRate(fuzzy);
    if (rate) {
      return { trade: rate.trade, confidence: 0.85, method: "alias" };
    }
  }

  // Tier 3: Unknown
  return { trade: "Unknown", confidence: 0.3, method: "unknown" };
}

// ============================================================================
// DBWD Rate Lookup — delegates to dbwd-retrieval service
// ============================================================================

/**
 * Look up DBWD rate information for a trade.
 *
 * @param trade Trade classification string
 * @returns DBWD rate info or null if not found
 */
async function lookupDBWDRate(trade: string, locality?: string): Promise<DBWDRateInfo | null> {
  // PoC: locality filtering not yet implemented (see docs/architecture/retrieval-upgrade-path.md)
  return lookupRate(trade, locality);
}

// ============================================================================
// Compliance Checks
// ============================================================================

/**
 * Validate prevailing wage (40 U.S.C. § 3142)
 */
function checkPrevailingWage(
  extracted: ExtractedWCP,
  dbwdRate: DBWDRateInfo,
  checkId: number
): CheckResult {
  const passed = extracted.wage >= dbwdRate.baseRate;
  const difference = passed ? undefined : dbwdRate.baseRate - extracted.wage;

  return {
    id: `base_wage_check_${String(checkId).padStart(3, "0")}`,
    type: "wage",
    passed,
    regulation: "40 U.S.C. § 3142(a)",
    expected: dbwdRate.baseRate,
    actual: extracted.wage,
    difference,
    severity: passed ? "info" : "critical",
    message: passed
      ? `Base wage $${extracted.wage.toFixed(2)} meets prevailing wage $${dbwdRate.baseRate.toFixed(2)}`
      : `UNDERPAYMENT: Base wage $${extracted.wage.toFixed(2)} below prevailing wage $${dbwdRate.baseRate.toFixed(2)} (owes $${difference!.toFixed(2)}/hr)`,
  };
}

/**
 * Validate overtime calculation (CWHSSA — 40 U.S.C. §§ 3701-3708 / 29 CFR 5.32)
 *
 * Under CWHSSA, overtime for hours > 40/week on covered federal contracts
 * requires a premium of 0.5× the basic rate of pay (half-time premium).
 * Fringe benefits are owed on ALL hours worked at the straight-time rate —
 * they are NOT multiplied by 1.5 for overtime hours.
 *
 * Correct gross pay = (regularHours × baseRate) + (overtimeHours × baseRate × 1.5)
 * Fringe obligation = totalHours × fringeRate (separate from gross pay)
 *
 * Source: 29 CFR 5.32; DOL CWHSSA Overtime Slides; DOL Fact Sheet #66E
 */
function checkOvertime(
  extracted: ExtractedWCP,
  dbwdRate: DBWDRateInfo,
  checkId: number
): CheckResult {
  if (extracted.overtimeHours === 0) {
    return {
      id: `overtime_check_${String(checkId).padStart(3, "0")}`,
      type: "overtime",
      passed: true,
      regulation: "29 CFR 5.32 (CWHSSA)",
      severity: "info",
      message: "No overtime hours worked",
    };
  }

  // Correct gross pay: regular hours at base + OT hours at 1.5× base
  // Fringe is NOT included in gross pay (reported separately on WH-347)
  const regularHrs = extracted.regularHours ?? Math.min(extracted.hours, 40);
  const overtimeHrs = extracted.overtimeHours ?? Math.max(0, extracted.hours - 40);
  const correctGrossPay =
    regularHrs * dbwdRate.baseRate +
    overtimeHrs * dbwdRate.baseRate * 1.5;

  // Gross pay if contractor wrongly paid straight time for all hours
  const straightTimeGrossPay = extracted.hours * dbwdRate.baseRate;

  // Use reported grossPay if available; otherwise infer from wage field
  const reportedGrossPay =
    extracted.grossPay ?? extracted.wage * extracted.hours;

  // Violation: reported gross < correct gross (OT premium underpaid)
  const overtimePremiumOwed = correctGrossPay - straightTimeGrossPay;
  const passed = reportedGrossPay >= correctGrossPay - 0.01; // $0.01 tolerance

  const owedAmount = correctGrossPay - reportedGrossPay;

  return {
    id: `overtime_check_${String(checkId).padStart(3, "0")}`,
    type: "overtime",
    passed,
    regulation: "29 CFR 5.32 (CWHSSA)",
    expected: correctGrossPay,
    actual: reportedGrossPay,
    difference: passed ? undefined : owedAmount,
    severity: passed ? "info" : "critical",
    message: passed
      ? `Overtime gross pay $${reportedGrossPay.toFixed(2)} meets CWHSSA requirement ($${correctGrossPay.toFixed(2)}): ${regularHrs}h × $${dbwdRate.baseRate} + ${overtimeHrs}h × $${(dbwdRate.baseRate * 1.5).toFixed(2)}`
      : `OVERTIME ERROR: Gross pay $${reportedGrossPay.toFixed(2)} below CWHSSA requirement $${correctGrossPay.toFixed(2)} (OT premium of $${overtimePremiumOwed.toFixed(2)} underpaid — owes $${owedAmount.toFixed(2)} total)`,
  };
}

/**
 * Validate total hours: sum of hoursByDay vs reported hours (±0.25h tolerance)
 *
 * Regulation: 29 CFR 5.5(a)(3)(ii) — certified payroll must accurately reflect hours
 */
function checkTotals(
  extracted: ExtractedWCP,
  checkId: number
): CheckResult {
  const id = `total_hours_check_${String(checkId).padStart(3, "0")}`;

  if (!extracted.hoursByDay || Object.keys(extracted.hoursByDay).length === 0) {
    return {
      id,
      type: "total_hours",
      passed: true,
      regulation: "29 CFR 5.5(a)(3)(ii)",
      severity: "warning",
      message: "No per-day hours provided; cannot cross-check total hours",
    };
  }

  const dayValues = Object.values(extracted.hoursByDay as Record<string, number>);
  const computedTotal = dayValues.reduce((sum, h) => sum + h, 0);
  const delta = Math.abs(computedTotal - extracted.hours);
  const passed = delta <= 0.25;

  return {
    id,
    type: "total_hours",
    passed,
    regulation: "29 CFR 5.5(a)(3)(ii)",
    expected: extracted.hours,
    actual: computedTotal,
    difference: passed ? undefined : delta,
    severity: passed ? "info" : "error",
    message: passed
      ? `Per-day hours sum (${computedTotal}h) matches reported total (${extracted.hours}h) within ±0.25h tolerance`
      : `TOTAL_MISMATCH: Per-day hours sum (${computedTotal}h) differs from reported total (${extracted.hours}h) by ${delta.toFixed(2)}h (tolerance: ±0.25h)`,
  };
}

/**
 * Validate that a signature is present on the certified payroll
 *
 * Regulation: 29 CFR 5.5(a)(3)(ii)(B) — payroll must be certified
 */
function checkSignatures(
  extracted: ExtractedWCP,
  checkId: number
): CheckResult {
  const id = `signature_check_${String(checkId).padStart(3, "0")}`;
  const hasSig = Array.isArray(extracted.signatures) && extracted.signatures.length > 0;

  return {
    id,
    type: "signature",
    passed: hasSig,
    regulation: "29 CFR 5.5(a)(3)(ii)(B)",
    severity: hasSig ? "info" : "warning",
    message: hasSig
      ? `Certified payroll signed by: ${extracted.signatures!.join(", ")}`
      : "MISSING_SIGNATURE: No signature found on certified payroll — WH-347 requires contractor certification",
  };
}

/**
 * Per-employee overtime checks: OVERTIME_WEEKLY (>40h/week) and OVERTIME_DAILY (>8h/day)
 *
 * Regulation: 29 CFR 5.32 (CWHSSA); 40 U.S.C. §§ 3701-3708
 */
function checkEmployeeOvertime(
  employees: ExtractedEmployee[],
  checkId: number
): CheckResult[] {
  const results: CheckResult[] = [];
  let id = checkId;

  for (const emp of employees) {
    const name = emp.workerName ?? emp.role;

    if (emp.hoursByDay && Object.keys(emp.hoursByDay).length > 0) {
      const days = emp.hoursByDay as Record<string, number>;
      const weeklyTotal = Object.values(days).reduce((s, h) => s + h, 0);

      const weeklyPassed = weeklyTotal <= 40;
      results.push({
        id: `overtime_weekly_check_${String(id++).padStart(3, "0")}`,
        type: "overtime_weekly",
        passed: weeklyPassed,
        regulation: "29 CFR 5.32 (CWHSSA)",
        actual: weeklyTotal,
        severity: weeklyPassed ? "info" : "critical",
        message: weeklyPassed
          ? `${name}: ${weeklyTotal}h/week — no weekly overtime`
          : `OVERTIME_WEEKLY: ${name} worked ${weeklyTotal}h/week (${weeklyTotal - 40}h overtime) — OT premium required`,
      });

      for (const [day, hours] of Object.entries(days)) {
        if (hours > 8) {
          results.push({
            id: `overtime_daily_check_${String(id++).padStart(3, "0")}`,
            type: "overtime_daily",
            passed: false,
            regulation: "29 CFR 5.32 (CWHSSA)",
            actual: hours,
            severity: "warning",
            message: `OVERTIME_DAILY: ${name} worked ${hours}h on ${day} (>${ 8}h/day threshold)`,
          });
        }
      }
    }
  }

  return results;
}

/**
 * Validate fringe benefits (40 U.S.C. § 3141(2)(B) / 29 CFR 5.5(a)(1)(i))
 *
 * The prevailing wage obligation = basic hourly rate (BHR) + fringe benefits.
 * Contractors may satisfy the fringe obligation by:
 *   (a) paying fringe entirely as cash wages alongside the BHR, or
 *   (b) contributing to a bona fide fringe benefit plan, or
 *   (c) a combination of (a) and (b).
 *
 * IMPORTANT (DOL Fact Sheet #66E / 29 CFR 5.31): Under DBRA (unlike SCA),
 * cash wages paid IN EXCESS of the BHR may be used to offset the fringe
 * benefit portion of the prevailing wage obligation.
 *
 * Therefore the check is: (reportedWage + reportedFringe) >= (BHR + fringeRate)
 * — not a strict fringe-only comparison.
 *
 * Fringe benefits must be paid on ALL hours worked, including overtime hours.
 * Source: 40 U.S.C. § 3141(2)(B); 29 CFR 5.5(a)(1)(i); 29 CFR 5.23; 29 CFR 5.31
 */
function checkFringeBenefits(
  extracted: ExtractedWCP,
  dbwdRate: DBWDRateInfo,
  checkId: number
): CheckResult {
  const reportedFringe = extracted.fringe ?? 0;

  // Per DOL Fact Sheet #66E: cash wages above BHR can offset fringe shortfall
  const cashWageExcess = Math.max(0, extracted.wage - dbwdRate.baseRate);
  const effectiveFringe = reportedFringe + cashWageExcess;

  const passed = effectiveFringe >= dbwdRate.fringeRate;
  const difference = passed ? undefined : dbwdRate.fringeRate - effectiveFringe;

  const baseResult: CheckResult = {
    id: `fringe_check_${String(checkId).padStart(3, "0")}`,
    type: "fringe",
    passed,
    regulation: "29 CFR 5.5(a)(1)(i) / 40 U.S.C. § 3141(2)(B)",
    expected: dbwdRate.fringeRate,
    actual: effectiveFringe,
    difference,
    severity: passed ? "info" : "error",
    message: passed
      ? `Fringe obligation met: $${reportedFringe.toFixed(2)}/hr fringe${cashWageExcess > 0 ? ` + $${cashWageExcess.toFixed(2)}/hr cash wage offset` : ""} ≥ required $${dbwdRate.fringeRate.toFixed(2)}/hr`
      : `FRINGE SHORTFALL: Effective fringe $${effectiveFringe.toFixed(2)}/hr (reported: $${reportedFringe.toFixed(2)} + wage excess: $${cashWageExcess.toFixed(2)}) below required $${dbwdRate.fringeRate.toFixed(2)}/hr (owes $${difference!.toFixed(2)}/hr)`,
  };

  return baseResult;
}

/**
 * H6: Explicit fringe rate underpayment check against DBWD required rate
 *
 * When the WH-347 form contains an explicit reportedFringeRate field,
 * validate it directly against the DBWD required fringe rate.
 *
 * Regulation: 29 CFR 5.5(a)(1)(i) / 40 U.S.C. § 3141(2)(B)
 */
function checkFringeUnderpayment(
  extracted: ExtractedWCP,
  dbwdRate: DBWDRateInfo,
  checkId: number
): CheckResult | null {
  if (extracted.reportedFringeRate === undefined) return null;

  const passed = extracted.reportedFringeRate >= dbwdRate.fringeRate;
  const difference = passed ? undefined : dbwdRate.fringeRate - extracted.reportedFringeRate;

  return {
    id: `fringe_underpayment_check_${String(checkId).padStart(3, "0")}`,
    type: "fringe",
    passed,
    regulation: "29 CFR 5.5(a)(1)(i) / 40 U.S.C. § 3141(2)(B)",
    expected: dbwdRate.fringeRate,
    actual: extracted.reportedFringeRate,
    difference,
    severity: passed ? "info" : "error",
    message: passed
      ? `Reported fringe rate $${extracted.reportedFringeRate.toFixed(2)}/hr meets DBWD required $${dbwdRate.fringeRate.toFixed(2)}/hr`
      : `FRINGE_UNDERPAYMENT: Reported fringe rate $${extracted.reportedFringeRate.toFixed(2)}/hr is below DBWD required $${dbwdRate.fringeRate.toFixed(2)}/hr (shortfall: $${difference!.toFixed(2)}/hr)`,
  };
}

/**
 * Validate classification resolution (29 CFR 5.5(a)(3)(i))
 */
function checkClassification(
  extracted: ExtractedWCP,
  classification: ClassificationResult,
  checkId: number
): CheckResult {
  const passed = classification.method !== "unknown";

  return {
    id: `classification_check_${String(checkId).padStart(3, "0")}`,
    type: "classification",
    passed,
    regulation: "29 CFR 5.5(a)(3)(i)",
    severity: passed ? "info" : "critical",
    message: passed
      ? `Classification "${extracted.role}" resolved to "${classification.trade}" via ${classification.method} match (confidence: ${classification.confidence.toFixed(2)})`
      : `UNKNOWN CLASSIFICATION: "${extracted.role}" could not be resolved to a known trade (confidence: ${classification.confidence.toFixed(2)}) - requires manual review`,
  };
}

/**
 * Validate no zero hours with wages reported (data integrity check)
 */
function checkZeroHoursWithWage(
  extracted: ExtractedWCP,
  checkId: number
): CheckResult {
  const passed = !(extracted.hours === 0 && extracted.wage > 0);

  return {
    id: `data_integrity_check_${String(checkId).padStart(3, "0")}`,
    type: "data_integrity",
    passed,
    regulation: "29 CFR 5.5(a)(3)",
    severity: passed ? "info" : "critical",
    message: passed
      ? "Hours and wage data are consistent"
      : `DATA INTEGRITY ERROR: Zero hours reported but wage is $${extracted.wage.toFixed(2)}/hr - invalid payroll data`,
  };
}

/**
 * Validate no negative values (data integrity check)
 */
function checkNegativeValues(
  extracted: ExtractedWCP,
  checkId: number
): CheckResult {
  const hasNegative = extracted.hours < 0 || extracted.wage < 0 || (extracted.fringe ?? 0) < 0;
  const passed = !hasNegative;

  return {
    id: `data_integrity_check_${String(checkId).padStart(3, "0")}`,
    type: "data_integrity",
    passed,
    regulation: "29 CFR 5.5(a)(3)",
    severity: passed ? "info" : "critical",
    message: passed
      ? "All values are non-negative"
      : `DATA INTEGRITY ERROR: Negative values detected - hours: ${extracted.hours}, wage: ${extracted.wage}, fringe: ${extracted.fringe ?? 0}`,
  };
}

/**
 * Sanity check: wage must be at least the FLSA federal minimum ($7.25/hr).
 *
 * Note: On Davis-Bacon contracts the effective floor is the prevailing wage
 * (always >> $7.25), so this check catches only extreme data-entry errors
 * (e.g. zero wages, obviously corrupt data). The prevailing wage check
 * (checkPrevailingWage) enforces the actual Davis-Bacon obligation.
 *
 * EO 14026 ($17.75/hr for federal contractors) was revoked 2025-03-14;
 * for contracts awarded after that date the applicable floor reverts to
 * the FLSA federal minimum of $7.25/hr (29 U.S.C. § 206(a)(1)).
 *
 * Regulation: 29 U.S.C. § 206(a)(1) (FLSA); 40 U.S.C. § 3142 governs
 * the actual prevailing wage obligation.
 */
function checkMinimumWage(
  extracted: ExtractedWCP,
  checkId: number
): CheckResult {
  // FLSA federal minimum wage — floor sanity check only
  // (Davis-Bacon prevailing wage is always higher and checked separately)
  const FLSA_MINIMUM_WAGE = 7.25; // 29 U.S.C. § 206(a)(1)
  const passed = extracted.wage >= FLSA_MINIMUM_WAGE;
  const difference = passed ? undefined : FLSA_MINIMUM_WAGE - extracted.wage;

  return {
    id: `minimum_wage_check_${String(checkId).padStart(3, "0")}`,
    type: "minimum_wage",
    passed,
    regulation: "29 U.S.C. § 206(a)(1) (FLSA)",
    expected: FLSA_MINIMUM_WAGE,
    actual: extracted.wage,
    difference,
    severity: passed ? "info" : "critical",
    message: passed
      ? `Wage $${extracted.wage.toFixed(2)}/hr meets FLSA floor $${FLSA_MINIMUM_WAGE}/hr (Davis-Bacon prevailing wage checked separately)`
      : `MINIMUM WAGE VIOLATION: Wage $${extracted.wage.toFixed(2)}/hr below FLSA federal minimum $${FLSA_MINIMUM_WAGE}/hr (29 U.S.C. § 206(a)(1)) — owes $${difference!.toFixed(2)}/hr`,
  };
}

/**
 * Validate reasonable hours (workweek reasonableness check)
 * Max reasonable hours: 84 hours/week (2× 40-hour workweek)
 */
function checkReasonableHours(
  extracted: ExtractedWCP,
  checkId: number
): CheckResult {
  const MAX_REASONABLE_HOURS = 84; // 2× standard workweek
  const passed = extracted.hours <= MAX_REASONABLE_HOURS && extracted.hours >= 0;

  return {
    id: `hours_check_${String(checkId).padStart(3, "0")}`,
    type: "hours",
    passed,
    regulation: "29 CFR 5.5(a)(3)",
    actual: extracted.hours,
    severity: passed ? "info" : "error",
    message: passed
      ? `Hours ${extracted.hours} within reasonable range (0-${MAX_REASONABLE_HOURS})`
      : `HOURS OUT OF RANGE: ${extracted.hours} hours exceeds reasonable maximum ${MAX_REASONABLE_HOURS} hours/week - requires verification`,
  };
}

// ============================================================================
// Main Layer 1 Function
// ============================================================================

/**
 * Layer 1: Deterministic Scaffold
 *
 * Produces a complete DeterministicReport with all compliance checks.
 * This function is 100% deterministic - same input always produces same output.
 *
 * @param input Raw WCP text input
 * @param traceId Unique trace ID for this decision
 * @returns DeterministicReport with all checks and findings
 */
export async function layer1Deterministic(
  input: string,
  traceId: string
): Promise<DeterministicReport> {
  const startTime = Date.now();
  const timings: { stage: string; ms: number }[] = [];

  log.info({ traceId }, "Starting deterministic scaffold");

  // Step 1: Extract structured data
  const extractStart = Date.now();
  const extracted = await extractWCPData(input);
  timings.push({ stage: "extraction", ms: Date.now() - extractStart });

  // Step 2: Resolve classification via hybrid retrieval
  const classifyStart = Date.now();
  const classification = await resolveClassification(extracted.role);
  timings.push({ stage: "classification", ms: Date.now() - classifyStart });

  // Step 3: Look up DBWD rate (already fetched in Step 2 via hybrid retriever,
  //         but we call again to surface the canonical rate info for the report)
  const lookupStart = Date.now();
  const dbwdRate = await lookupDBWDRate(classification.trade, extracted.localityCode);
  timings.push({ stage: "dbwd_lookup", ms: Date.now() - lookupStart });

  // Step 4: Run compliance checks
  const checkStart = Date.now();
  const checks: CheckResult[] = [];
  let checkId = 1;

  // Data integrity checks (always run)
  checks.push(checkNegativeValues(extracted, checkId++));
  checks.push(checkZeroHoursWithWage(extracted, checkId++));
  checks.push(checkReasonableHours(extracted, checkId++));
  checks.push(checkMinimumWage(extracted, checkId++));

  // H3: Cross-check hoursByDay sum vs. reported total hours
  checks.push(checkTotals(extracted, checkId++));

  // H4: Signature presence check
  checks.push(checkSignatures(extracted, checkId++));

  // Classification check (always run)
  checks.push(checkClassification(extracted, classification, checkId++));

  if (dbwdRate) {
    // Only run wage checks if we have a valid DBWD rate
    checks.push(checkPrevailingWage(extracted, dbwdRate, checkId++));
    checks.push(checkOvertime(extracted, dbwdRate, checkId++));
    checks.push(checkFringeBenefits(extracted, dbwdRate, checkId++));

    // H6: Explicit fringe underpayment check (only when reportedFringeRate present)
    const fringeUnderpayment = checkFringeUnderpayment(extracted, dbwdRate, checkId++);
    if (fringeUnderpayment) checks.push(fringeUnderpayment);

    // H5: Per-employee overtime checks (only when employees[] present)
    if (extracted.employees && extracted.employees.length > 0) {
      const empOtChecks = checkEmployeeOvertime(extracted.employees, checkId);
      checkId += empOtChecks.length;
      checks.push(...empOtChecks);
    }
  } else {
    // Add a check result indicating we couldn't validate wages
    checks.push({
      id: `dbwd_lookup_${String(checkId++).padStart(3, "0")}`,
      type: "wage",
      passed: false,
      regulation: "40 U.S.C. § 3142(a)",
      severity: "critical",
      message: `Cannot validate wages: Unknown trade "${classification.trade}" not found in DBWD database`,
    });
  }

  timings.push({ stage: "compliance_checks", ms: Date.now() - checkStart });

  // Step 5: Compute deterministic score
  // Critical failures tank the score (deterministic layer must be clean)
  const hasCriticalFailure = checks.some((c) => c.severity === "critical" && !c.passed);
  const passedChecks = checks.filter((c) => c.passed).length;
  const totalChecks = checks.length;
  const deterministicScore = hasCriticalFailure ? 0 : passedChecks / totalChecks;

  // Build the report
  const report: DeterministicReport = {
    traceId,
    dbwdVersion: dbwdRate?.version ?? "unknown",
    timestamp: new Date().toISOString(),
    extracted,
    dbwdRate: dbwdRate ?? {
      dbwdId: "UNKNOWN",
      baseRate: 0,
      fringeRate: 0,
      totalRate: 0,
      version: "unknown",
      effectiveDate: "unknown",
      trade: classification.trade,
    },
    checks,
    classificationMethod: classification.method,
    classificationConfidence: classification.confidence,
    deterministicScore,
    timings,
  };

  const totalTime = Date.now() - startTime;
  log.info({ traceId, totalMs: totalTime, deterministicScore }, "Layer 1 completed");

  return report;
}

// ============================================================================
// Exports
// ============================================================================

export { resolveClassification, lookupDBWDRate };
export type { ClassificationResult };
