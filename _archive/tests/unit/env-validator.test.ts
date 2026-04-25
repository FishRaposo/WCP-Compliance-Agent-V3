import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateEnvironment } from '../../src/utils/env-validator.js';

describe('validateEnvironment', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('OPENAI_API_KEY validation', () => {
    it('passes with mock key', () => {
      process.env.OPENAI_API_KEY = 'mock';
      const result = validateEnvironment();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('passes with mock-key', () => {
      process.env.OPENAI_API_KEY = 'mock-key';
      const result = validateEnvironment();
      expect(result.isValid).toBe(true);
    });

    it('passes with test-api-key', () => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      const result = validateEnvironment();
      expect(result.isValid).toBe(true);
    });

    it('passes with real sk- key (>=20 chars)', () => {
      process.env.OPENAI_API_KEY = 'sk-' + 'a'.repeat(20);
      const result = validateEnvironment();
      expect(result.isValid).toBe(true);
    });

    it('fails with short sk- key (<20 chars)', () => {
      process.env.OPENAI_API_KEY = 'sk-short';
      const result = validateEnvironment();
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('OPENAI_API_KEY');
    });

    it('fails with missing key', () => {
      delete process.env.OPENAI_API_KEY;
      const result = validateEnvironment();
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it('fails with arbitrary invalid key', () => {
      process.env.OPENAI_API_KEY = 'not-valid-key';
      const result = validateEnvironment();
      expect(result.isValid).toBe(false);
    });
  });

  describe('OPENAI_MODEL optional validation', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'mock';
    });

    it('passes with valid model gpt-4o-mini', () => {
      process.env.OPENAI_MODEL = 'gpt-4o-mini';
      const result = validateEnvironment();
      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('passes with valid model gpt-4o', () => {
      process.env.OPENAI_MODEL = 'gpt-4o';
      const result = validateEnvironment();
      expect(result.isValid).toBe(true);
    });

    it('warns with invalid model and resets to default', () => {
      process.env.OPENAI_MODEL = 'gpt-invalid-model';
      const result = validateEnvironment();
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(process.env.OPENAI_MODEL).toBe('gpt-4o-mini');
    });

    it('sets default when not provided', () => {
      delete process.env.OPENAI_MODEL;
      const result = validateEnvironment();
      expect(result.isValid).toBe(true);
      expect(process.env.OPENAI_MODEL).toBe('gpt-4o-mini');
    });
  });

  describe('AGENT_MAX_STEPS optional validation', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'mock';
    });

    it('passes with valid steps 3', () => {
      process.env.AGENT_MAX_STEPS = '3';
      const result = validateEnvironment();
      expect(result.isValid).toBe(true);
    });

    it('warns with steps out of range and resets to default', () => {
      process.env.AGENT_MAX_STEPS = '99';
      const result = validateEnvironment();
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(process.env.AGENT_MAX_STEPS).toBe('3');
    });

    it('sets default when not provided', () => {
      delete process.env.AGENT_MAX_STEPS;
      const result = validateEnvironment();
      expect(process.env.AGENT_MAX_STEPS).toBe('3');
    });
  });

  describe('LOG_LEVEL optional validation', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'mock';
    });

    it('passes with info level', () => {
      process.env.LOG_LEVEL = 'info';
      const result = validateEnvironment();
      expect(result.isValid).toBe(true);
    });

    it('warns with invalid level', () => {
      process.env.LOG_LEVEL = 'verbose';
      const result = validateEnvironment();
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('NODE_ENV optional validation', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'mock';
    });

    it('passes with development', () => {
      process.env.NODE_ENV = 'development';
      const result = validateEnvironment();
      expect(result.isValid).toBe(true);
    });

    it('passes with production', () => {
      process.env.NODE_ENV = 'production';
      const result = validateEnvironment();
      expect(result.isValid).toBe(true);
    });

    it('warns with invalid env value', () => {
      process.env.NODE_ENV = 'staging-invalid';
      const result = validateEnvironment();
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('result shape', () => {
    it('returns object with isValid, errors, warnings', () => {
      process.env.OPENAI_API_KEY = 'mock';
      const result = validateEnvironment();
      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });
});
