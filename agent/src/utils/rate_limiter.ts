// Utility rate limiter for external API calls (e.g., SAM.gov).
// Separate from the HTTP middleware in middleware/rate_limiter.ts.

export class ExternalAPIRateLimiter {
  private queue: Array<() => void> = [];
  private activeRequests = 0;

  constructor(
    private readonly maxConcurrent: number = 5,
    private readonly minIntervalMs: number = 200
  ) {}

  async throttle<T>(fn: () => Promise<T>): Promise<T> {
    // TODO: implement token bucket / sliding window for external API calls
    return fn();
  }
}

export const samGovLimiter = new ExternalAPIRateLimiter(3, 500);
