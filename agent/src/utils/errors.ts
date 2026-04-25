export class WCPError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = "WCPError";
  }
}

export class BackendError extends WCPError {
  constructor(message: string, public readonly endpoint: string) {
    super(message, "BACKEND_ERROR", 502);
    this.name = "BackendError";
  }
}

export class ValidationError extends WCPError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR", 422);
    this.name = "ValidationError";
  }
}

export class RateLimitError extends WCPError {
  constructor() {
    super("Rate limit exceeded", "RATE_LIMIT", 429);
    this.name = "RateLimitError";
  }
}
