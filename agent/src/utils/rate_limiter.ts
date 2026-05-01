// Utility rate limiter for external API calls (e.g., SAM.gov).
// Separate from the HTTP middleware in middleware/rate_limiter.ts.

export class ExternalAPIRateLimiter {
  private queue: Array<() => void> = [];
  private activeRequests = 0;
  private tokens: number;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly maxConcurrent: number = 5,
    private readonly minIntervalMs: number = 200
  ) {
    this.tokens = maxConcurrent;
    this.startRefill();
  }

  private startRefill() {
    this.timer = setInterval(() => {
      if (this.tokens < this.maxConcurrent) {
        this.tokens++;
        this.processQueue();
      }
    }, this.minIntervalMs);
    // Unref the timer so it doesn't prevent Node.js from exiting if no requests are pending
    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  private processQueue(): void {
    while (
      this.queue.length > 0 &&
      this.tokens > 0 &&
      this.activeRequests < this.maxConcurrent
    ) {
      this.tokens--;
      this.activeRequests++;
      const next = this.queue.shift();
      if (next) {
        next();
      }
    }
  }

  async throttle<T>(fn: () => Promise<T>): Promise<T> {
    await new Promise<void>((resolve) => {
      this.queue.push(resolve);
      this.processQueue();
    });

    try {
      return await fn();
    } finally {
      this.activeRequests--;
      this.processQueue();
    }
  }
}

export const samGovLimiter = new ExternalAPIRateLimiter(3, 500);
