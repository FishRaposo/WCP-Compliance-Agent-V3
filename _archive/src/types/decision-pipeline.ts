/**
 * Decision Pipeline Types
 *
 * Typed contracts for the three-layer decision architecture:
 * 1. DeterministicReport (Layer 1)
 * 2. LLMVerdict (Layer 2)
 * 3. TrustScoredDecision (Layer 3)
 *
 * These types enforce the pipeline structure at compile time.
 * Runtime validation uses Zod schemas.
 *
 * @see docs/architecture/decision-architecture.md
 * @see docs/adrs/ADR-005-decision-architecture.md
 */

import { z } from "zod";

// ============================================================================
// Layer 1: Deterministic Scaffold
// ============================================================================

/**
 * Check Result from deterministic validation
 *
 * @see docs/compliance/traceability-matrix.md - Links to regulations
 */
export interface CheckResult {
  /** Unique identifier for this check (e.g., "base_wage_check_001") */
  id: string;

  /** Type of compliance check */
  type: "wage" | "overtime" | "fringe" | "classification" | "deduction" | "data_integrity" | "minimum_wage" | "hours" | "total_hours" | "signature" | "overtime_weekly" | "overtime_daily";

  /** Whether the check passed */
  passed: boolean;

  /** Statutory citation (e.g., "40 U.S.C. § 3142(a)") */
  regulation: string;

  /** Expected value (from DBWD or rules) */
  expected?: number;

  /** Actual value (from WCP) */
  actual?: number;

  /** Difference (if numeric comparison) */
  difference?: number;

  /** Severity of failure */
  severity: "info" | "warning" | "error" | "critical" | "high";

  /** Human-readable explanation */
  message: string;
}

/**
 * Per-employee record within a WH-347 certified payroll
 */
export interface ExtractedEmployee {
  /** Worker's full name */
  workerName?: string;

  /** Worker classification/trade role */
  role: string;

  /** Last 4 digits of SSN — masked for privacy */
  socialSecurityLast4?: string;

  /** Hours worked per day of week */
  hoursByDay?: {
    mon?: number;
    tue?: number;
    wed?: number;
    thu?: number;
    fri?: number;
    sat?: number;
    sun?: number;
  };

  /** Regular hours (≤ 40) */
  regularHours?: number;

  /** Overtime hours (> 40) */
  overtimeHours?: number;

  /** Gross pay for the week */
  grossPay?: number;

  /** Fringe benefit rate */
  fringe?: number;

  /** Reported base hourly rate */
  reportedBaseRate?: number;
}

/**
 * Extracted WCP data — full WH-347 data model
 */
export interface ExtractedWCP {
  /** Raw input text (for audit trail) */
  rawInput: string;

  /** Worker name (if available) — single-worker shorthand */
  workerName?: string;

  /** Last 4 digits of SSN — masked for privacy */
  socialSecurityLast4?: string;

  /** Worker classification/trade role */
  role: string;

  /** DBWD trade code resolved by retrieval (e.g. "ELEC0490") */
  tradeCode?: string;

  /** Locality code for wage determination */
  localityCode?: string;

  /** Total hours worked this week */
  hours: number;

  /** Regular hours (≤ 40) */
  regularHours?: number;

  /** Overtime hours (> 40) */
  overtimeHours?: number;

  /** Hours by day of week */
  hoursByDay?: {
    mon?: number;
    tue?: number;
    wed?: number;
    thu?: number;
    fri?: number;
    sat?: number;
    sun?: number;
  };

  /** Hourly wage rate (base) */
  wage: number;

  /** Fringe benefit rate */
  fringe?: number;

  /** Total gross pay (if extracted or computed) */
  grossPay?: number;

  /** Week ending date (YYYY-MM-DD if available) */
  weekEnding?: string;

  /** Week start date (YYYY-MM-DD if available) */
  weekStart?: string;

  /** Project or contract ID */
  projectId?: string;

  /** Subcontractor name (WH-347 box 1) */
  subcontractor?: string;

  /** Reported base hourly rate (may differ from wage field) */
  reportedBaseRate?: number;

  /** Reported fringe rate (explicit from form) */
  reportedFringeRate?: number;

  /** Reported total compensation (base + fringe) */
  reportedTotalPay?: number;

  /** Signatories on the certified payroll */
  signatures?: string[];

  /** Per-employee records (multi-worker payrolls) */
  employees?: ExtractedEmployee[];
}

/**
 * DBWD Rate Information
 */
export interface DBWDRateInfo {
  /** DBWD identifier (e.g., "ELEC0490-002") */
  dbwdId: string;

  /** Base hourly wage */
  baseRate: number;

  /** Fringe benefit rate */
  fringeRate: number;

  /** Total compensation = base + fringe */
  totalRate: number;

  /** SAM.gov version/date */
  version: string;

  /** Effective date of this rate */
  effectiveDate: string;

  /** Locality info */
  locality?: string;

  /** Trade/classification name */
  trade: string;

  /** DBWD trade code (e.g. "ELEC0490") */
  tradeCode?: string;
}

/**
 * Deterministic Report (Layer 1 Output)
 *
 * Contains all objectively verifiable facts about the WCP submission.
 * NO AI-generated content. 100% reproducible.
 */
export interface DeterministicReport {
  /** Unique trace ID for this decision */
  traceId: string;

  /** DBWD version used for lookups */
  dbwdVersion: string;

  /** Timestamp when report was generated */
  timestamp: string;

  /** Extracted structured data from WCP */
  extracted: ExtractedWCP;

  /** DBWD rate information for the classification */
  dbwdRate: DBWDRateInfo;

  /** All compliance checks performed */
  checks: CheckResult[];

  /** Classification method used */
  classificationMethod: "exact" | "alias" | "semantic" | "manual" | "unknown";

  /** Confidence in classification (0-1) based on method */
  classificationConfidence: number;

  /** Score for deterministic layer (0-1): fraction of checks that ran cleanly */
  deterministicScore: number;

  /** Per-stage timings for performance monitoring */
  timings: { stage: string; ms: number }[];
}

// ============================================================================
// Layer 2: LLM Verdict
// ============================================================================

/**
 * Regulatory Citation
 */
export interface RegulatoryCitation {
  /** Statute or regulation (e.g., "40 U.S.C. § 3142(a)") */
  statute: string;

  /** Human-readable description */
  description: string;

  /** DBWD identifier (if applicable) */
  dbwdId?: string;
}

/**
 * LLM Verdict (Layer 2 Output)
 *
 * LLM reasoning over the deterministic report.
 * MUST reference check IDs from Layer 1.
 * MUST NOT recompute values.
 */
export interface LLMVerdict {
  /** Same trace ID as report */
  traceId: string;

  /** Compliance decision status */
  status: "Approved" | "Revise" | "Reject";

  /** Human-readable rationale */
  rationale: string;

  /**
   * Check IDs referenced in rationale.
   * MUST be non-empty subset of report.checks[].id
   * Runtime validation enforces this.
   */
  referencedCheckIds: string[];

  /** Regulatory citations supporting the verdict */
  citations: RegulatoryCitation[];

  /** LLM's self-reported confidence (0-1) */
  selfConfidence: number;

  /** Full reasoning trace (CoT or structured steps) */
  reasoningTrace: string;

  /**
   * Token usage for cost tracking.
   * Also included in health metrics for backward compatibility.
   */
  tokenUsage: number;

  /** Model used for this verdict */
  model: string;

  /** Timestamp */
  timestamp: string;

  /** Prompt version used to generate this verdict (for audit trail) */
  promptVersion?: number;

  /** Prompt key used (e.g., "wcp_verdict") */
  promptKey?: string;
}

// ============================================================================
// Layer 3: Trust Score + Human Review
// ============================================================================

/**
 * Trust Score Components
 */
export interface TrustScoreComponents {
  /** From deterministic layer (0-1) */
  deterministic: number;

  /** From classification confidence (0-1) */
  classification: number;

  /** From LLM self-reported confidence (0-1) */
  llmSelf: number;

  /** From LLM/deterministic agreement (0-1) */
  agreement: number;
}

/**
 * Trust Score (Layer 3 Output Component)
 */
export interface TrustScore {
  /** Overall trust score (0-1) */
  score: number;

  /** Component breakdown */
  components: TrustScoreComponents;

  /** Trust band / action required */
  band: "auto" | "flag_for_review" | "require_human";

  /** Reasons for this band assignment */
  reasons: string[];
}

/**
 * Human Review State
 */
export interface HumanReview {
  /** Whether human review is required */
  required: boolean;

  /** Current review status */
  status: "not_required" | "pending" | "approved" | "rejected";

  /** When queued for review (ISO timestamp) */
  queuedAt?: string;

  /** When review completed (ISO timestamp) */
  reviewedAt?: string;

  /** Reviewer identifier */
  reviewer?: string;

  /** Reviewer notes/explanation */
  notes?: string;

  /** Override reason (if applicable) */
  overrideReason?: string;
}

/**
 * Audit Event for full traceability
 */
export interface AuditEvent {
  /** ISO timestamp */
  timestamp: string;

  /** Pipeline stage */
  stage: "layer1" | "layer2" | "layer3" | "human_review" | "final";

  /** Event type */
  event:
    | "check_completed"
    | "llm_reasoning"
    | "trust_computed"
    | "enqueued"
    | "reviewed"
    | "finalized";

  /** Event details */
  details: Record<string, unknown>;

  /** Optional content hash for tamper detection */
  hash?: string;
}

/**
 * Trust Scored Decision (Layer 3 Output)
 *
 * Final output of the three-layer pipeline.
 * This is the ONLY type that can be returned from generateWcpDecision().
 */
export interface TrustScoredDecision {
  /** Unique trace ID */
  traceId: string;

  /** Layer 1 deterministic report */
  deterministic: DeterministicReport;

  /** Layer 2 LLM verdict */
  verdict: LLMVerdict;

  /** Layer 3 trust score */
  trust: TrustScore;

  /** Human review state */
  humanReview: HumanReview;

  /** Full audit trail */
  auditTrail: AuditEvent[];

  /**
   * Final decision status.
   * May be "Pending Human Review" if trust requires human review.
   */
  finalStatus: "Approved" | "Revise" | "Reject" | "Pending Human Review";

  /** Timestamp when decision finalized */
  finalizedAt: string;

  /**
   * Health metrics for monitoring and observability.
   * Preserved from original WCPDecision for backward compatibility.
   */
  health?: {
    /** Processing time in milliseconds */
    cycleTime: number;

    /** Total tokens consumed (Layer 2 LLM) */
    tokenUsage: number;

    /** Validation score based on check results (0-1) */
    validationScore: number;

    /** Overall confidence in decision (derived from trust.score) */
    confidence: number;
  };
}

// ============================================================================
// Zod Schemas for Runtime Validation
// ============================================================================

export const CheckResultSchema = z.object({
  id: z.string(),
  type: z.enum(["wage", "overtime", "fringe", "classification", "deduction", "data_integrity", "minimum_wage", "hours", "total_hours", "signature", "overtime_weekly", "overtime_daily"]),
  passed: z.boolean(),
  regulation: z.string(),
  expected: z.number().optional(),
  actual: z.number().optional(),
  difference: z.number().optional(),
  severity: z.enum(["info", "warning", "error", "critical", "high"]),
  message: z.string(),
});

export const ExtractedEmployeeSchema = z.object({
  workerName: z.string().optional(),
  role: z.string(),
  socialSecurityLast4: z.string().optional(),
  hoursByDay: z.object({
    mon: z.number().min(0).optional(),
    tue: z.number().min(0).optional(),
    wed: z.number().min(0).optional(),
    thu: z.number().min(0).optional(),
    fri: z.number().min(0).optional(),
    sat: z.number().min(0).optional(),
    sun: z.number().min(0).optional(),
  }).optional(),
  regularHours: z.number().min(0).optional(),
  overtimeHours: z.number().min(0).optional(),
  grossPay: z.number().min(0).optional(),
  fringe: z.number().min(0).optional(),
  reportedBaseRate: z.number().min(0).optional(),
});

export const ExtractedWCPSchema = z.object({
  rawInput: z.string(),
  workerName: z.string().optional(),
  socialSecurityLast4: z.string().optional(),
  role: z.string(),
  tradeCode: z.string().optional(),
  localityCode: z.string().optional(),
  hours: z.number().min(0),
  regularHours: z.number().min(0).optional(),
  overtimeHours: z.number().min(0).optional(),
  hoursByDay: z.object({
    mon: z.number().min(0).optional(),
    tue: z.number().min(0).optional(),
    wed: z.number().min(0).optional(),
    thu: z.number().min(0).optional(),
    fri: z.number().min(0).optional(),
    sat: z.number().min(0).optional(),
    sun: z.number().min(0).optional(),
  }).optional(),
  wage: z.number().min(0),
  fringe: z.number().min(0).optional(),
  grossPay: z.number().min(0).optional(),
  weekEnding: z.string().optional(),
  weekStart: z.string().optional(),
  projectId: z.string().optional(),
  subcontractor: z.string().optional(),
  reportedBaseRate: z.number().min(0).optional(),
  reportedFringeRate: z.number().min(0).optional(),
  reportedTotalPay: z.number().min(0).optional(),
  signatures: z.array(z.string()).optional(),
  employees: z.array(ExtractedEmployeeSchema).optional(),
});

export const DBWDRateInfoSchema = z.object({
  dbwdId: z.string(),
  baseRate: z.number(),
  fringeRate: z.number(),
  totalRate: z.number(),
  version: z.string(),
  effectiveDate: z.string(),
  locality: z.string().optional(),
  trade: z.string(),
  tradeCode: z.string().optional(),
});

export const DeterministicReportSchema = z.object({
  traceId: z.string(),
  dbwdVersion: z.string(),
  timestamp: z.string(),
  extracted: ExtractedWCPSchema,
  dbwdRate: DBWDRateInfoSchema,
  checks: z.array(CheckResultSchema),
  classificationMethod: z.enum(["exact", "alias", "semantic", "manual", "unknown"]),
  classificationConfidence: z.number().min(0).max(1),
  deterministicScore: z.number().min(0).max(1),
  timings: z.array(z.object({ stage: z.string(), ms: z.number() })),
});

export const RegulatoryCitationSchema = z.object({
  statute: z.string(),
  description: z.string(),
  dbwdId: z.string().optional(),
});

export const LLMVerdictSchema = z.object({
  traceId: z.string(),
  status: z.enum(["Approved", "Revise", "Reject"]),
  rationale: z.string(),
  referencedCheckIds: z.array(z.string()).min(1), // Must reference at least one check
  citations: z.array(RegulatoryCitationSchema),
  selfConfidence: z.number().min(0).max(1),
  reasoningTrace: z.string(),
  tokenUsage: z.number(),
  model: z.string(),
  timestamp: z.string(),
  promptVersion: z.number().optional(),
  promptKey: z.string().optional(),
});

export const TrustScoreComponentsSchema = z.object({
  deterministic: z.number().min(0).max(1),
  classification: z.number().min(0).max(1),
  llmSelf: z.number().min(0).max(1),
  agreement: z.number().min(0).max(1),
});

export const TrustScoreSchema = z.object({
  score: z.number().min(0).max(1),
  components: TrustScoreComponentsSchema,
  band: z.enum(["auto", "flag_for_review", "require_human"]),
  reasons: z.array(z.string()),
});

export const HumanReviewSchema = z.object({
  required: z.boolean(),
  status: z.enum(["not_required", "pending", "approved", "rejected"]),
  queuedAt: z.string().optional(),
  reviewedAt: z.string().optional(),
  reviewer: z.string().optional(),
  notes: z.string().optional(),
  overrideReason: z.string().optional(),
});

export const AuditEventSchema = z.object({
  timestamp: z.string(),
  stage: z.enum(["layer1", "layer2", "layer3", "human_review", "final"]),
  event: z.enum([
    "check_completed",
    "llm_reasoning",
    "trust_computed",
    "enqueued",
    "reviewed",
    "finalized",
  ]),
  details: z.record(z.unknown()),
  hash: z.string().optional(),
});

/**
 * Final decision schema - this is the ONLY valid output of the pipeline
 */
export const TrustScoredDecisionSchema = z.object({
  traceId: z.string(),
  deterministic: DeterministicReportSchema,
  verdict: LLMVerdictSchema,
  trust: TrustScoreSchema,
  humanReview: HumanReviewSchema,
  auditTrail: z.array(AuditEventSchema),
  finalStatus: z.enum(["Approved", "Revise", "Reject", "Pending Human Review"]),
  finalizedAt: z.string(),
}).superRefine((data, ctx) => {
  if (data.deterministic.traceId !== data.traceId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `deterministic.traceId (${data.deterministic.traceId}) must equal root traceId (${data.traceId})`,
      path: ["deterministic", "traceId"],
    });
  }
  if (data.verdict.traceId !== data.traceId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `verdict.traceId (${data.verdict.traceId}) must equal root traceId (${data.traceId})`,
      path: ["verdict", "traceId"],
    });
  }
});

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Validate that a value is a valid TrustScoredDecision
 */
export function isTrustScoredDecision(value: unknown): value is TrustScoredDecision {
  return TrustScoredDecisionSchema.safeParse(value).success;
}

/**
 * Validate referenced check IDs exist in the report
 */
export function validateReferencedCheckIds(
  verdict: LLMVerdict,
  report: DeterministicReport
): { valid: boolean; missing: string[] } {
  const validIds = new Set(report.checks.map((c) => c.id));
  const missing = verdict.referencedCheckIds.filter((id) => !validIds.has(id));
  return { valid: missing.length === 0, missing };
}

// ============================================================================
// Human Review Queue Types
// ============================================================================

/**
 * Review Queue Item
 *
 * Represents a decision pending human review.
 */
export interface ReviewQueueItem {
  /** Decision trace ID */
  traceId: string;

  /** When queued for review */
  queuedAt: string;

  /** Priority level */
  priority: "low" | "normal" | "high" | "critical";

  /** Snapshot of decision at time of enqueue */
  decision: TrustScoredDecision;

  /** Current review status */
  status: "pending" | "approved" | "rejected" | "escalated";

  /** Assigned reviewer */
  assignedTo?: string;

  /** When reviewer started */
  startedAt?: string;

  /** When review completed */
  completedAt?: string;

  /** Reviewer decision */
  reviewerDecision?: "Approved" | "Revise" | "Reject" | "override_to_approved" | "override_to_reject";

  /** Reviewer notes */
  notes?: string;

  /** Override reason if applicable */
  overrideReason?: string;

  /** Reviewer identity */
  reviewer?: string;

  /** Audit trail of review actions */
  auditTrail: ReviewAuditEvent[];
}

/**
 * Review Audit Event
 */
export interface ReviewAuditEvent {
  /** ISO timestamp */
  timestamp: string;

  /** Who performed the action ("system" or reviewer ID) */
  actor: string;

  /** Action type */
  action: "enqueued" | "assigned" | "viewed" | "decided" | "escalated";

  /** Event details */
  details: Record<string, unknown>;
}
