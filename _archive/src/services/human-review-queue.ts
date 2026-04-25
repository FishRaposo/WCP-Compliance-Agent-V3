/**
 * Human Review Queue Service (Stub Implementation)
 *
 * Phase 01 (Current): In-memory queue with JSON file persistence
 * Phase 02 (Future): PostgreSQL backend with 7-year retention
 *
 * Manages the queue of compliance decisions requiring human review.
 *
 * @see docs/architecture/human-review-workflow.md - Full workflow documentation
 * @see docs/adrs/ADR-005-decision-architecture.md - Architectural decision
 */

import { promises as fs } from "fs";
import { join } from "path";
import type {
  TrustScoredDecision,
  ReviewQueueItem,
  ReviewAuditEvent,
} from "../types/decision-pipeline.js";
import { childLogger } from "../utils/logger.js";

const log = childLogger("HumanReviewQueue");

// ============================================================================
// Configuration
// ============================================================================

/** Queue storage file (Phase 01 stub - JSON file persistence) */
const QUEUE_FILE = process.env.REVIEW_QUEUE_PATH
  ? process.env.REVIEW_QUEUE_PATH
  : join(process.cwd(), "data", "review-queue.json");

/** In-memory storage */
let inMemoryQueue: Map<string, ReviewQueueItem> = new Map();

// ============================================================================
// Priority Determination
// ============================================================================

/**
 * Determine priority from decision properties
 *
 * @param decision Trust scored decision
 * @returns Priority level
 */
function determinePriority(
  decision: TrustScoredDecision
): "low" | "normal" | "high" | "critical" {
  const { trust, verdict } = decision;

  // Critical: agreement failure (system contradiction)
  if (trust.components.agreement === 0) {
    return "critical";
  }

  // Critical: underpayment violations (critical check failure)
  const hasCriticalViolation = decision.deterministic.checks.some(
    (c) => c.severity === "critical" && !c.passed
  );
  if (hasCriticalViolation) {
    return "critical";
  }

  // High: very low trust
  if (trust.score < 0.4) {
    return "high";
  }

  // High: unknown classification
  if (decision.deterministic.classificationMethod === "unknown") {
    return "high";
  }

  // Normal: flag for review (trust 0.60-0.84)
  if (trust.band === "flag_for_review") {
    return "normal";
  }

  // Low: everything else
  return "low";
}

// ============================================================================
// Persistence (Phase 01 Stub)
// ============================================================================

/**
 * Load queue from JSON file
 */
async function loadQueue(): Promise<Map<string, ReviewQueueItem>> {
  try {
    const data = await fs.readFile(QUEUE_FILE, "utf-8");
    const parsed = JSON.parse(data) as ReviewQueueItem[];
    const map = new Map<string, ReviewQueueItem>();
    for (const item of parsed) {
      map.set(item.traceId, item);
    }
    return map;
  } catch {
    // File doesn't exist or is corrupt - start fresh
    return new Map();
  }
}

/**
 * Save queue to JSON file
 */
async function saveQueue(queue: Map<string, ReviewQueueItem>): Promise<void> {
  try {
    await fs.mkdir(join(process.cwd(), "data"), { recursive: true });
    const items = Array.from(queue.values());
    await fs.writeFile(QUEUE_FILE, JSON.stringify(items, null, 2), "utf-8");
  } catch (error) {
    log.error({ err: error }, "Failed to save queue");
    // Non-blocking: in-memory queue continues to work
  }
}

// ============================================================================
// Queue Service Implementation
// ============================================================================

/**
 * Human Review Queue Service
 *
 * In-memory fallback for development and single-process deployments.
 */
class HumanReviewQueueService {
  private queue: Map<string, ReviewQueueItem> = new Map();
  private initialized = false;

  /**
   * Initialize the service (load from disk)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.queue = await loadQueue();
    this.initialized = true;

    const pendingCount = Array.from(this.queue.values()).filter(
      (i) => i.status === "pending"
    ).length;
    log.info({ pendingCount }, "Queue initialized");
  }

  /**
   * Enqueue a decision for human review
   *
   * @param decision Trust scored decision
   * @returns Enqueued item
   */
  async enqueue(decision: TrustScoredDecision): Promise<ReviewQueueItem> {
    await this.initialize();

    const now = new Date().toISOString();
    const priority = determinePriority(decision);

    const item: ReviewQueueItem = {
      traceId: decision.traceId,
      queuedAt: now,
      priority,
      decision,
      status: "pending",
      auditTrail: [
        {
          timestamp: now,
          actor: "system",
          action: "enqueued",
          details: {
            trustScore: decision.trust.score,
            band: decision.trust.band,
            priority,
          },
        },
      ],
    };

    this.queue.set(decision.traceId, item);
    await saveQueue(this.queue);

    log.info({ traceId: decision.traceId, priority, trustScore: decision.trust.score }, "Decision enqueued");

    return item;
  }

  /**
   * List pending items
   *
   * @param options Filter options
   * @returns Array of pending items (sorted by priority, then age)
   */
  async listPending(options?: {
    priority?: "low" | "normal" | "high" | "critical";
    assignedTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<ReviewQueueItem[]> {
    await this.initialize();

    let items = Array.from(this.queue.values()).filter(
      (i) => i.status === "pending"
    );

    // Apply priority filter
    if (options?.priority) {
      items = items.filter((i) => i.priority === options.priority);
    }

    // Apply assigned filter
    if (options?.assignedTo !== undefined) {
      items = items.filter((i) => i.assignedTo === options.assignedTo);
    }

    // Sort by priority (critical > high > normal > low), then by age (oldest first)
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    items.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      // ISO 8601 strings are lexicographically sortable; avoid Date allocation
      return a.queuedAt < b.queuedAt ? -1 : a.queuedAt > b.queuedAt ? 1 : 0;
    });

    // Apply pagination
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? items.length;
    return items.slice(offset, offset + limit);
  }

  /**
   * Get a specific item by trace ID
   *
   * @param traceId Decision trace ID
   * @returns Item or null if not found
   */
  async get(traceId: string): Promise<ReviewQueueItem | null> {
    await this.initialize();
    return this.queue.get(traceId) ?? null;
  }

  /**
   * Assign an item to a reviewer
   *
   * @param traceId Decision trace ID
   * @param reviewer Reviewer identifier
   * @returns Updated item
   */
  async assign(traceId: string, reviewer: string): Promise<ReviewQueueItem> {
    await this.initialize();

    const item = this.queue.get(traceId);
    if (!item) {
      throw new Error(`Item not found: ${traceId}`);
    }

    if (item.status !== "pending") {
      throw new Error(`Item ${traceId} is not pending (status: ${item.status})`);
    }

    const now = new Date().toISOString();
    item.assignedTo = reviewer;
    item.startedAt = now;
    item.auditTrail.push({
      timestamp: now,
      actor: reviewer,
      action: "assigned",
      details: {},
    });

    this.queue.set(traceId, item);
    await saveQueue(this.queue);

    log.info({ traceId, reviewer }, "Decision assigned");
    return item;
  }

  /**
   * Submit reviewer decision
   *
   * @param traceId Decision trace ID
   * @param decision Reviewer decision
   * @param reviewer Reviewer identifier
   * @param notes Optional reviewer notes
   * @returns Updated item
   */
  async submitReview(
    traceId: string,
    decision: "Approved" | "Revise" | "Reject" | "override_to_approved" | "override_to_reject",
    reviewer: string,
    notes?: string
  ): Promise<ReviewQueueItem> {
    await this.initialize();

    const item = this.queue.get(traceId);
    if (!item) {
      throw new Error(`Item not found: ${traceId}`);
    }

    if (item.status !== "pending") {
      throw new Error(`Item ${traceId} is not pending (status: ${item.status})`);
    }

    const now = new Date().toISOString();
    const isOverride = decision.startsWith("override_to_");

    item.reviewerDecision = decision;
    item.reviewer = reviewer;
    item.completedAt = now;
    item.notes = notes;
    item.status = "approved"; // Review completed
    item.auditTrail.push({
      timestamp: now,
      actor: reviewer,
      action: "decided",
      details: {
        decision,
        isOverride,
        notes,
      },
    });

    this.queue.set(traceId, item);
    await saveQueue(this.queue);

    log.info({ traceId, decision, reviewer, isOverride }, "Review submitted");
    return item;
  }

  /**
   * Escalate an item to specialist review
   *
   * @param traceId Decision trace ID
   * @param reason Escalation reason
   * @param escalatedBy Who is escalating
   * @returns Updated item
   */
  async escalate(
    traceId: string,
    reason: string,
    escalatedBy: string
  ): Promise<ReviewQueueItem> {
    await this.initialize();

    const item = this.queue.get(traceId);
    if (!item) {
      throw new Error(`Item not found: ${traceId}`);
    }

    if (item.status !== "pending") {
      throw new Error(`Item ${traceId} is not pending (status: ${item.status})`);
    }

    const now = new Date().toISOString();
    item.status = "escalated";
    item.priority = "critical"; // Escalated items are critical
    item.auditTrail.push({
      timestamp: now,
      actor: escalatedBy,
      action: "escalated",
      details: { reason },
    });

    this.queue.set(traceId, item);
    await saveQueue(this.queue);

    log.info({ traceId, reason }, "Decision escalated");
    return item;
  }

  /**
   * Get queue statistics
   *
   * @returns Queue statistics
   */
  async getStats(): Promise<{
    pendingCount: number;
    byPriority: Record<string, number>;
    avgTimeToReview?: number;
  }> {
    await this.initialize();

    const items = Array.from(this.queue.values());
    const pending = items.filter((i) => i.status === "pending");

    const byPriority: Record<string, number> = {
      critical: 0,
      high: 0,
      normal: 0,
      low: 0,
    };

    for (const item of pending) {
      const key = item.priority as keyof typeof byPriority;
      byPriority[key] = (byPriority[key] ?? 0) + 1;
    }

    // Calculate average time to review (completed items only)
    const completed = items.filter((i) => i.status === "approved" && i.completedAt);
    let avgTimeToReview: number | undefined;
    if (completed.length > 0) {
      const totalMs = completed.reduce((sum, i) => {
        // Use Date.parse() to avoid allocating Date objects
        const start = Date.parse(i.queuedAt);
        const end = Date.parse(i.completedAt!);
        return sum + (end - start);
      }, 0);
      avgTimeToReview = Math.round(totalMs / completed.length / 1000 / 60); // Minutes
    }

    return {
      pendingCount: pending.length,
      byPriority,
      avgTimeToReview,
    };
  }

  /**
   * Clear the queue (for testing)
   */
  async clear(): Promise<void> {
    this.queue.clear();
    await saveQueue(this.queue);
    log.info("Queue cleared");
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/** Global queue service instance */
export const humanReviewQueue = new HumanReviewQueueService();

// ============================================================================
// Exports
// ============================================================================

export { HumanReviewQueueService };
export { determinePriority };
