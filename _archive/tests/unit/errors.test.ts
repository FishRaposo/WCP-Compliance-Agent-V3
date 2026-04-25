import { describe, it, expect } from 'vitest';
import {
  WCPError,
  ConfigError,
  ValidationError,
  NotFoundError,
  ExternalApiError,
  RateLimitError,
  Layer1Error,
  Layer2Error,
  Layer3Error,
  ExtractionError,
  DBWDLookupError,
  LLMGenerationError,
  LLMParseError,
  TrustScoreError,
  extractErrorDetails,
  formatApiError,
  asyncHandler,
  recoverLayer1Error,
  recoverLayer2Error,
  recoverLayer3Error,
  isRetryableError,
  getRetryDelay,
} from '../../src/utils/errors.js';

describe('WCPError', () => {
  it('sets message, code, statusCode', () => {
    const err = new WCPError('test msg', 'TEST_CODE', 400);
    expect(err.message).toBe('test msg');
    expect(err.code).toBe('TEST_CODE');
    expect(err.statusCode).toBe(400);
  });

  it('defaults statusCode to 500', () => {
    const err = new WCPError('test', 'CODE');
    expect(err.statusCode).toBe(500);
  });

  it('stores details', () => {
    const err = new WCPError('test', 'CODE', 500, { foo: 'bar' });
    expect(err.details).toEqual({ foo: 'bar' });
  });

  it('toJSON returns structured object', () => {
    const err = new WCPError('test', 'CODE', 400);
    const json = err.toJSON();
    expect(json.error.name).toBe('WCPError');
    expect(json.error.code).toBe('CODE');
    expect(json.error.message).toBe('test');
    expect(json.error.statusCode).toBe(400);
  });

  it('is instanceof Error', () => {
    expect(new WCPError('t', 'C')).toBeInstanceOf(Error);
  });
});

describe('Specific error subclasses', () => {
  it('ConfigError has correct code and status', () => {
    const err = new ConfigError('bad config');
    expect(err.code).toBe('CONFIG_ERROR');
    expect(err.statusCode).toBe(500);
    expect(err.name).toBe('ConfigError');
  });

  it('ValidationError has 400 status', () => {
    const err = new ValidationError('invalid input');
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe('ValidationError');
  });

  it('NotFoundError has 404 status', () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
    expect(err.name).toBe('NotFoundError');
  });

  it('NotFoundError accepts custom message', () => {
    const err = new NotFoundError('specific thing not found');
    expect(err.message).toBe('specific thing not found');
  });

  it('ExternalApiError has 502 status', () => {
    const err = new ExternalApiError('upstream down');
    expect(err.statusCode).toBe(502);
    expect(err.name).toBe('ExternalApiError');
  });

  it('RateLimitError has 429 status', () => {
    const err = new RateLimitError();
    expect(err.statusCode).toBe(429);
    expect(err.name).toBe('RateLimitError');
  });

  it('Layer1Error has LAYER1_ERROR code', () => {
    const err = new Layer1Error('layer 1 fail');
    expect(err.code).toBe('LAYER1_ERROR');
    expect(err.name).toBe('Layer1Error');
  });

  it('Layer2Error has LAYER2_ERROR code', () => {
    const err = new Layer2Error('layer 2 fail');
    expect(err.code).toBe('LAYER2_ERROR');
  });

  it('Layer3Error has LAYER3_ERROR code', () => {
    const err = new Layer3Error('layer 3 fail');
    expect(err.code).toBe('LAYER3_ERROR');
  });

  it('ExtractionError is instanceof Layer1Error', () => {
    const err = new ExtractionError('extract fail');
    expect(err).toBeInstanceOf(Layer1Error);
    expect(err.name).toBe('ExtractionError');
  });

  it('DBWDLookupError is instanceof Layer1Error', () => {
    const err = new DBWDLookupError('lookup fail');
    expect(err).toBeInstanceOf(Layer1Error);
    expect(err.name).toBe('DBWDLookupError');
  });

  it('LLMGenerationError is instanceof Layer2Error', () => {
    const err = new LLMGenerationError('gen fail');
    expect(err).toBeInstanceOf(Layer2Error);
    expect(err.name).toBe('LLMGenerationError');
  });

  it('LLMParseError is instanceof Layer2Error', () => {
    const err = new LLMParseError('parse fail');
    expect(err).toBeInstanceOf(Layer2Error);
    expect(err.name).toBe('LLMParseError');
  });

  it('TrustScoreError is instanceof Layer3Error', () => {
    const err = new TrustScoreError('trust fail');
    expect(err).toBeInstanceOf(Layer3Error);
    expect(err.name).toBe('TrustScoreError');
  });
});

describe('extractErrorDetails', () => {
  it('handles WCPError', () => {
    const err = new ValidationError('bad input', { field: 'wage' });
    const details = extractErrorDetails(err);
    expect(details.code).toBe('VALIDATION_ERROR');
    expect(details.statusCode).toBe(400);
    expect(details.message).toBe('bad input');
  });

  it('handles plain Error', () => {
    const err = new Error('plain error');
    const details = extractErrorDetails(err);
    expect(details.code).toBe('UNKNOWN_ERROR');
    expect(details.statusCode).toBe(500);
    expect(details.message).toBe('plain error');
  });

  it('handles string error', () => {
    const details = extractErrorDetails('something went wrong');
    expect(details.code).toBe('UNKNOWN_ERROR');
    expect(details.message).toBe('something went wrong');
  });

  it('handles unknown object', () => {
    const details = extractErrorDetails({ weird: 'object' });
    expect(details.code).toBe('UNKNOWN_ERROR');
    expect(details.statusCode).toBe(500);
  });
});

describe('formatApiError', () => {
  it('returns success false', () => {
    const result = formatApiError(new ValidationError('bad'));
    expect(result.success).toBe(false);
  });

  it('includes error object with message, code, statusCode', () => {
    const result = formatApiError(new ValidationError('bad input'));
    expect(result.error.message).toBe('bad input');
    expect(result.error.code).toBe('VALIDATION_ERROR');
    expect(result.error.statusCode).toBe(400);
  });

  it('handles plain Error', () => {
    const result = formatApiError(new Error('oops'));
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('UNKNOWN_ERROR');
  });
});

describe('asyncHandler', () => {
  it('returns success true with data on success', async () => {
    const result = await asyncHandler(async () => 'hello');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('hello');
  });

  it('returns success false with WCPError on WCPError throw', async () => {
    const result = await asyncHandler(async () => {
      throw new ValidationError('invalid');
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(WCPError);
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('wraps non-WCPError in WCPError', async () => {
    const result = await asyncHandler(async () => {
      throw new Error('plain');
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(WCPError);
      expect(result.error.code).toBe('INTERNAL_ERROR');
    }
  });
});

describe('recoverLayer1Error', () => {
  it('returns true for ExtractionError', () => {
    expect(recoverLayer1Error(new ExtractionError('e'))).toBe(true);
  });

  it('returns false for DBWDLookupError', () => {
    expect(recoverLayer1Error(new DBWDLookupError('e'))).toBe(false);
  });

  it('returns false for generic Layer1Error', () => {
    expect(recoverLayer1Error(new Layer1Error('e'))).toBe(false);
  });
});

describe('recoverLayer2Error', () => {
  it('returns true for LLMParseError', () => {
    expect(recoverLayer2Error(new LLMParseError('e'))).toBe(true);
  });

  it('returns false for LLMGenerationError', () => {
    expect(recoverLayer2Error(new LLMGenerationError('e'))).toBe(false);
  });

  it('returns false for generic Layer2Error', () => {
    expect(recoverLayer2Error(new Layer2Error('e'))).toBe(false);
  });
});

describe('recoverLayer3Error', () => {
  it('always returns false', () => {
    expect(recoverLayer3Error(new TrustScoreError('e'))).toBe(false);
    expect(recoverLayer3Error(new Layer3Error('e'))).toBe(false);
  });
});

describe('isRetryableError', () => {
  it('RateLimitError is retryable', () => {
    expect(isRetryableError(new RateLimitError())).toBe(true);
  });

  it('ExternalApiError is retryable', () => {
    expect(isRetryableError(new ExternalApiError('e'))).toBe(true);
  });

  it('LLMGenerationError is retryable', () => {
    expect(isRetryableError(new LLMGenerationError('e'))).toBe(true);
  });

  it('ValidationError is not retryable', () => {
    expect(isRetryableError(new ValidationError('e'))).toBe(false);
  });

  it('WCPError is not retryable', () => {
    expect(isRetryableError(new WCPError('e', 'CODE'))).toBe(false);
  });
});

describe('getRetryDelay', () => {
  it('returns exponential backoff for RateLimitError', () => {
    const err = new RateLimitError();
    const delay0 = getRetryDelay(err, 0);
    const delay1 = getRetryDelay(err, 1);
    expect(delay0).toBe(1000);
    expect(delay1).toBe(2000);
  });

  it('caps RateLimitError delay at 60000', () => {
    const err = new RateLimitError();
    const delay = getRetryDelay(err, 20);
    expect(delay).toBe(60000);
  });

  it('returns fixed 2000 for ExternalApiError', () => {
    expect(getRetryDelay(new ExternalApiError('e'), 0)).toBe(2000);
    expect(getRetryDelay(new ExternalApiError('e'), 3)).toBe(2000);
  });

  it('returns 1000 for LLMGenerationError', () => {
    expect(getRetryDelay(new LLMGenerationError('e'), 0)).toBe(1000);
  });

  it('returns 0 for non-retryable errors', () => {
    expect(getRetryDelay(new WCPError('e', 'CODE'), 0)).toBe(0);
  });
});
