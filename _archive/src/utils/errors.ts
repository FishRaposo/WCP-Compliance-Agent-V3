/**
 * Error Handling Utility
 * 
 * Provides custom error classes and error handling utilities
 * for the WCP AI Agent project.
 * 
 * @file src/utils/errors.ts
 * @see AGENTS.md for coding patterns
 * @see CONTEXT.md for architecture decisions
 */

/**
 * Base error class for all WCP AI Agent errors
 */
export class WCPError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    details?: unknown
  ) {
    super(message);
    this.name = 'WCPError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, WCPError);
    }
  }

  /**
   * Convert error to JSON representation
   */
  toJSON() {
    return {
      error: {
        name: this.name,
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
        details: this.details,
      },
    };
  }
}

/**
 * Configuration error
 */
export class ConfigError extends WCPError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONFIG_ERROR', 500, details);
    this.name = 'ConfigError';
  }
}

/**
 * Validation error
 */
export class ValidationError extends WCPError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

/**
 * Not found error
 */
export class NotFoundError extends WCPError {
  constructor(message: string = 'Resource not found', details?: unknown) {
    super(message, 'NOT_FOUND', 404, details);
    this.name = 'NotFoundError';
  }
}

/**
 * External API error
 */
export class ExternalApiError extends WCPError {
  constructor(message: string, details?: unknown) {
    super(message, 'EXTERNAL_API_ERROR', 502, details);
    this.name = 'ExternalApiError';
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends WCPError {
  constructor(message: string = 'Rate limit exceeded', details?: unknown) {
    super(message, 'RATE_LIMIT_ERROR', 429, details);
    this.name = 'RateLimitError';
  }
}

/**
 * Layer 1 (Deterministic) error
 */
export class Layer1Error extends WCPError {
  constructor(message: string, details?: unknown) {
    super(message, 'LAYER1_ERROR', 500, details);
    this.name = 'Layer1Error';
  }
}

/**
 * Layer 2 (LLM Verdict) error
 */
export class Layer2Error extends WCPError {
  constructor(message: string, details?: unknown) {
    super(message, 'LAYER2_ERROR', 500, details);
    this.name = 'Layer2Error';
  }
}

/**
 * Layer 3 (Trust Score) error
 */
export class Layer3Error extends WCPError {
  constructor(message: string, details?: unknown) {
    super(message, 'LAYER3_ERROR', 500, details);
    this.name = 'Layer3Error';
  }
}

/**
 * Extraction error (Layer 1)
 */
export class ExtractionError extends Layer1Error {
  constructor(message: string, details?: unknown) {
    super(message, details);
    this.name = 'ExtractionError';
  }
}

/**
 * DBWD lookup error (Layer 1)
 */
export class DBWDLookupError extends Layer1Error {
  constructor(message: string, details?: unknown) {
    super(message, details);
    this.name = 'DBWDLookupError';
  }
}

/**
 * LLM generation error (Layer 2)
 */
export class LLMGenerationError extends Layer2Error {
  constructor(message: string, details?: unknown) {
    super(message, details);
    this.name = 'LLMGenerationError';
  }
}

/**
 * LLM parse error (Layer 2)
 */
export class LLMParseError extends Layer2Error {
  constructor(message: string, details?: unknown) {
    super(message, details);
    this.name = 'LLMParseError';
  }
}

/**
 * Trust score calculation error (Layer 3)
 */
export class TrustScoreError extends Layer3Error {
  constructor(message: string, details?: unknown) {
    super(message, details);
    this.name = 'TrustScoreError';
  }
}

/**
 * Extract error details from unknown error
 */
export function extractErrorDetails(error: unknown): {
  message: string;
  code: string;
  statusCode: number;
  details?: unknown;
} {
  if (error instanceof WCPError) {
    return {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      details: error.details,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: 'UNKNOWN_ERROR',
      statusCode: 500,
      // 🛡️ Sentinel: Removed stack trace from error details to prevent information leakage
      details: {},
    };
  }

  return {
    message: String(error),
    code: 'UNKNOWN_ERROR',
    statusCode: 500,
  };
}

/**
 * Format error for API response
 */
export function formatApiError(error: unknown): {
  success: false;
  error: {
    message: string;
    code: string;
    statusCode: number;
  };
} {
  const details = extractErrorDetails(error);
  
  return {
    success: false,
    error: {
      message: details.message,
      code: details.code,
      statusCode: details.statusCode,
    },
  };
}

/**
 * Async wrapper for error handling
 */
export async function asyncHandler<T>(
  fn: () => Promise<T>
): Promise<{ success: true; data: T } | { success: false; error: WCPError }> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    if (error instanceof WCPError) {
      return { success: false, error };
    }
    return {
      success: false,
      error: new WCPError(
        'An unexpected error occurred',
        'INTERNAL_ERROR',
        500,
        error
      ),
    };
  }
}

/**
 * Recovery strategy for Layer 1 errors
 */
export function recoverLayer1Error(error: Layer1Error): boolean {
  // Extraction errors can be recovered with fallback values
  if (error instanceof ExtractionError) {
    return true; // Can recover with default values
  }
  
  // DBWD lookup errors cannot be recovered (need database)
  if (error instanceof DBWDLookupError) {
    return false; // Cannot recover without database
  }
  
  return false;
}

/**
 * Recovery strategy for Layer 2 errors
 */
export function recoverLayer2Error(error: Layer2Error): boolean {
  // LLM parse errors can use fallback heuristic parser
  if (error instanceof LLMParseError) {
    return true; // Can recover with heuristic parser
  }
  
  // LLM generation errors can be retried in mock mode
  if (error instanceof LLMGenerationError) {
    return false; // Cannot recover without retry logic
  }
  
  return false;
}

/**
 * Recovery strategy for Layer 3 errors
 */
export function recoverLayer3Error(error: Layer3Error): boolean {
  // Trust score errors should not be recoverable (data integrity issue)
  return false;
}

/**
 * Determine if error is retryable
 */
export function isRetryableError(error: WCPError): boolean {
  // Rate limit errors are retryable
  if (error instanceof RateLimitError) {
    return true;
  }
  
  // External API errors are retryable
  if (error instanceof ExternalApiError) {
    return true;
  }
  
  // LLM generation errors are retryable
  if (error instanceof LLMGenerationError) {
    return true;
  }
  
  return false;
}

/**
 * Get retry delay in milliseconds based on error type
 */
export function getRetryDelay(error: WCPError, attempt: number): number {
  if (error instanceof RateLimitError) {
    // Exponential backoff for rate limits
    return Math.min(1000 * Math.pow(2, attempt), 60000);
  }
  
  if (error instanceof ExternalApiError) {
    // Fixed delay for API errors
    return 2000;
  }
  
  if (error instanceof LLMGenerationError) {
    // Short delay for LLM errors
    return 1000;
  }
  
  return 0;
}
