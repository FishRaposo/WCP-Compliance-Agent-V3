import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  HumanReviewQueueService,
  determinePriority,
} from '../../src/services/human-review-queue.js';
import type { TrustScoredDecision, CheckResult, DeterministicReport, LLMVerdict } from '../../src/types/decision-pipeline.js';

let tempDir: string;
let originalQueuePath: string | undefined;

beforeAll(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'hrq-test-'));
  originalQueuePath = process.env.REVIEW_QUEUE_PATH;
  process.env.REVIEW_QUEUE_PATH = join(tempDir, 'review-queue.json');
});

afterAll(() => {
  process.env.REVIEW_QUEUE_PATH = originalQueuePath;
  rmSync(tempDir, { recursive: true, force: true });
});

// ============================================================================
// Test helpers
// ============================================================================

function makeCheck(overrides: Partial<CheckResult> = {}): CheckResult {
  return {
    id: 'check_001',
    type: 'wage',
    passed: true,
    regulation: '40 U.S.C. § 3142',
    severity: 'info',
    message: 'OK',
    ...overrides,
  };
}

function makeReport(overrides: Partial<DeterministicReport> = {}): DeterministicReport {
  return {
    traceId: 'test-trace-001',
    dbwdVersion: '2024-06-01',
    timestamp: new Date().toISOString(),
    extracted: { rawInput: 'Test', role: 'Electrician', hours: 40, wage: 51.69 },
    dbwdRate: {
      dbwdId: 'ELEC001',
      baseRate: 51.69,
      fringeRate: 34.63,
      totalRate: 86.32,
      version: '2024-06-01',
      effectiveDate: '2024-06-01',
      trade: 'Electrician',
    },
    checks: [makeCheck()],
    classificationMethod: 'exact',
    classificationConfidence: 1.0,
    deterministicScore: 1.0,
    timings: [],
    ...overrides,
  };
}

function makeVerdict(status: 'Approved' | 'Revise' | 'Reject' = 'Approved'): LLMVerdict {
  return {
    traceId: 'test-trace-001',
    status,
    rationale: 'Test rationale',
    referencedCheckIds: ['check_001'],
    citations: [],
    selfConfidence: 0.95,
    reasoningTrace: 'Reviewed checks and found them valid.',
    tokenUsage: 100,
    model: 'gpt-4o-mini',
    timestamp: new Date().toISOString(),
  };
}

function makeDecision(overrides: Partial<TrustScoredDecision> = {}): TrustScoredDecision {
  const deterministic = makeReport();
  const verdict = makeVerdict();
  return {
    traceId: 'test-trace-001',
    deterministic,
    verdict,
    trust: {
      score: 0.45,
      band: 'require_human',
      components: {
        deterministic: 1.0,
        classification: 1.0,
        llmSelf: 0.95,
        agreement: 0,
      },
      reasons: [],
    },
    humanReview: {
      required: true,
      status: 'pending',
      queuedAt: new Date().toISOString(),
    },
    auditTrail: [],
    finalStatus: 'Pending Human Review',
    finalizedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// determinePriority
// ============================================================================

describe('determinePriority', () => {
  it('returns critical when agreement is 0', () => {
    const decision = makeDecision({
      trust: {
        score: 0.5,
        band: 'require_human',
        components: { deterministic: 1.0, classification: 1.0, llmSelf: 0.95, agreement: 0 },
        reasons: [],
      },
    });
    expect(determinePriority(decision)).toBe('critical');
  });

  it('returns critical when there is a critical check failure', () => {
    const decision = makeDecision({
      deterministic: makeReport({
        checks: [makeCheck({ severity: 'critical', passed: false })],
      }),
      trust: {
        score: 0.5,
        band: 'require_human',
        components: { deterministic: 1.0, classification: 1.0, llmSelf: 0.95, agreement: 1.0 },
        reasons: [],
      },
    });
    expect(determinePriority(decision)).toBe('critical');
  });

  it('returns high when trust < 0.4', () => {
    const decision = makeDecision({
      trust: {
        score: 0.3,
        band: 'require_human',
        components: { deterministic: 0.5, classification: 0.5, llmSelf: 0.5, agreement: 1.0 },
        reasons: [],
      },
    });
    expect(determinePriority(decision)).toBe('high');
  });

  it('returns high when classification is unknown', () => {
    const decision = makeDecision({
      deterministic: makeReport({ classificationMethod: 'unknown' }),
      trust: {
        score: 0.6,
        band: 'flag_for_review',
        components: { deterministic: 0.8, classification: 0.5, llmSelf: 0.8, agreement: 1.0 },
        reasons: [],
      },
    });
    expect(determinePriority(decision)).toBe('high');
  });

  it('returns normal for flag_for_review band', () => {
    const decision = makeDecision({
      trust: {
        score: 0.75,
        band: 'flag_for_review',
        components: { deterministic: 0.9, classification: 0.9, llmSelf: 0.9, agreement: 1.0 },
        reasons: [],
      },
    });
    expect(determinePriority(decision)).toBe('normal');
  });

  it('returns low for everything else', () => {
    const decision = makeDecision({
      trust: {
        score: 0.75,
        band: 'auto',
        components: { deterministic: 0.9, classification: 0.9, llmSelf: 0.9, agreement: 1.0 },
        reasons: [],
      },
    });
    expect(determinePriority(decision)).toBe('low');
  });
});

// ============================================================================
// HumanReviewQueueService
// ============================================================================

describe('HumanReviewQueueService', () => {
  let queue: HumanReviewQueueService;

  beforeEach(async () => {
    queue = new HumanReviewQueueService();
    await queue.clear();
  });

  describe('enqueue', () => {
    it('enqueues a decision and returns a ReviewQueueItem', async () => {
      const decision = makeDecision();
      const item = await queue.enqueue(decision);

      expect(item.traceId).toBe(decision.traceId);
      expect(item.status).toBe('pending');
      expect(item.priority).toBeDefined();
      expect(item.auditTrail.length).toBeGreaterThan(0);
    });

    it('sets critical priority for critical decisions', async () => {
      const decision = makeDecision({
        trust: {
          score: 0.45,
          band: 'require_human',
          components: { deterministic: 1.0, classification: 1.0, llmSelf: 0.95, agreement: 0 },
          reasons: [],
        },
      });
      const item = await queue.enqueue(decision);
      expect(item.priority).toBe('critical');
    });
  });

  describe('listPending', () => {
    it('returns empty array when queue is empty', async () => {
      const items = await queue.listPending();
      expect(items).toHaveLength(0);
    });

    it('returns enqueued items', async () => {
      await queue.enqueue(makeDecision({ traceId: 'trace-001' }));
      await queue.enqueue(makeDecision({ traceId: 'trace-002' }));

      const items = await queue.listPending();
      expect(items.length).toBe(2);
    });

    it('filters by priority', async () => {
      const criticalDecision = makeDecision({
        traceId: 'critical-001',
        trust: {
          score: 0.45,
          band: 'require_human',
          components: { deterministic: 1.0, classification: 1.0, llmSelf: 0.95, agreement: 0 },
          reasons: [],
        },
      });
      const normalDecision = makeDecision({
        traceId: 'normal-001',
        trust: {
          score: 0.75,
          band: 'flag_for_review',
          components: { deterministic: 0.9, classification: 0.9, llmSelf: 0.9, agreement: 1.0 },
          reasons: [],
        },
      });

      await queue.enqueue(criticalDecision);
      await queue.enqueue(normalDecision);

      const criticals = await queue.listPending({ priority: 'critical' });
      expect(criticals.length).toBe(1);
      expect(criticals[0].traceId).toBe('critical-001');
    });

    it('applies limit and offset', async () => {
      for (let i = 0; i < 5; i++) {
        await queue.enqueue(makeDecision({ traceId: `trace-${i}` }));
      }
      const page = await queue.listPending({ limit: 2, offset: 1 });
      expect(page.length).toBe(2);
    });
  });

  describe('get', () => {
    it('returns null for unknown traceId', async () => {
      const item = await queue.get('unknown-trace');
      expect(item).toBeNull();
    });

    it('returns enqueued item', async () => {
      const decision = makeDecision({ traceId: 'get-test-001' });
      await queue.enqueue(decision);

      const item = await queue.get('get-test-001');
      expect(item).not.toBeNull();
      expect(item!.traceId).toBe('get-test-001');
    });
  });

  describe('assign', () => {
    it('throws when item not found', async () => {
      await expect(queue.assign('nonexistent', 'reviewer-1')).rejects.toThrow('not found');
    });

    it('assigns item to reviewer', async () => {
      const decision = makeDecision({ traceId: 'assign-test-001' });
      await queue.enqueue(decision);

      const item = await queue.assign('assign-test-001', 'reviewer-1');
      expect(item.assignedTo).toBe('reviewer-1');
      expect(item.startedAt).toBeDefined();
      expect(item.auditTrail.some(e => e.action === 'assigned')).toBe(true);
    });
  });

  describe('submitReview', () => {
    it('throws when item not found', async () => {
      await expect(queue.submitReview('nonexistent', 'Approved', 'reviewer-1')).rejects.toThrow('not found');
    });

    it('completes review with Approved', async () => {
      const decision = makeDecision({ traceId: 'review-test-001' });
      await queue.enqueue(decision);

      const item = await queue.submitReview('review-test-001', 'Approved', 'reviewer-1', 'looks good');
      expect(item.reviewerDecision).toBe('Approved');
      expect(item.reviewer).toBe('reviewer-1');
      expect(item.notes).toBe('looks good');
      expect(item.status).toBe('approved');
      expect(item.completedAt).toBeDefined();
    });

    it('records override in audit trail', async () => {
      const decision = makeDecision({ traceId: 'override-test-001' });
      await queue.enqueue(decision);

      const item = await queue.submitReview('override-test-001', 'override_to_approved', 'admin');
      const decidedEvent = item.auditTrail.find(e => e.action === 'decided');
      expect(decidedEvent?.details.isOverride).toBe(true);
    });
  });

  describe('escalate', () => {
    it('throws when item not found', async () => {
      await expect(queue.escalate('nonexistent', 'reason', 'reviewer-1')).rejects.toThrow('not found');
    });

    it('escalates item and sets critical priority', async () => {
      const decision = makeDecision({ traceId: 'escalate-test-001' });
      await queue.enqueue(decision);

      const item = await queue.escalate('escalate-test-001', 'complex case', 'reviewer-1');
      expect(item.status).toBe('escalated');
      expect(item.priority).toBe('critical');
      expect(item.auditTrail.some(e => e.action === 'escalated')).toBe(true);
    });
  });

  describe('getStats', () => {
    it('returns zero counts for empty queue', async () => {
      const stats = await queue.getStats();
      expect(stats.pendingCount).toBe(0);
      expect(stats.byPriority.critical).toBe(0);
      expect(stats.avgTimeToReview).toBeUndefined();
    });

    it('counts pending items by priority', async () => {
      const criticalDecision = makeDecision({
        traceId: 'stats-critical-001',
        trust: {
          score: 0.3,
          band: 'require_human',
          components: { deterministic: 0.5, classification: 0.5, llmSelf: 0.5, agreement: 0 },
          reasons: [],
        },
      });
      await queue.enqueue(criticalDecision);

      const stats = await queue.getStats();
      expect(stats.pendingCount).toBe(1);
      expect(stats.byPriority.critical).toBe(1);
    });
  });

  describe('clear', () => {
    it('removes all items', async () => {
      await queue.enqueue(makeDecision({ traceId: 'clear-test-001' }));
      await queue.enqueue(makeDecision({ traceId: 'clear-test-002' }));
      await queue.clear();

      const items = await queue.listPending();
      expect(items.length).toBe(0);
    });
  });
});
