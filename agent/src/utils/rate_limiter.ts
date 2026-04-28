// Utility rate limiter for external API calls (e.g., SAM.gov).
// Separate from the HTTP middleware in middleware/rate_limiter.ts.

export class ExternalAPIRateLimiter {
  private queue: Array<() => void> = [];
  private activeRequests = 0;
  private lastRequestTime = 0;
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillIntervalMs: number;

  constructor(
    private readonly maxConcurrent: number = 5,
    private readonly minIntervalMs: number = 200
  ) {
    this.tokens = maxConcurrent;
    this.maxTokens = maxConcurrent;
    this.refillIntervalMs = minIntervalMs;
  }

  private async waitForSlot(): Promise<void> {
    if (this.activeRequests < this.maxConcurrent && this.tokens > 0) {
      this.tokens--;
      return;
    }

    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  private releaseSlot(): void {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < this.minIntervalMs) {
      setTimeout(() => this.processQueue(), this.minIntervalMs - elapsed);
    } else {
      this.processQueue();
    }
  }

  private processQueue(): void {
    if (this.queue.length === 0) {
      if (this.tokens < this.maxTokens) {
        this.tokens++;
      }
      return;
    }

    const next = this.queue.shift();
    if (next) {
      this.lastRequestTime = Date.now();
      next();
    }
  }

  async throttle<T>(fn: () => Promise<T>): Promise<T> {
    await this.waitForSlot();
    this.activeRequests++;
    this.lastRequestTime = Date.now();

    try {
      return await fn();
    } finally {
      this.activeRequests--;
      this.releaseSlot();
    }
  }
}

export const samGovLimiter = new ExternalAPIRateLimiter(3, 500);
