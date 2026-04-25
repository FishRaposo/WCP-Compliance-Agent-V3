import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAppConfig } from '../../src/config/app-config.js';

describe('getAppConfig', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('environment', () => {
    it('defaults to development', () => {
      delete process.env.NODE_ENV;
      const config = getAppConfig();
      expect(config.environment).toBe('development');
    });

    it('reads NODE_ENV', () => {
      process.env.NODE_ENV = 'production';
      const config = getAppConfig();
      expect(config.environment).toBe('production');
    });

    it('reads test env', () => {
      process.env.NODE_ENV = 'test';
      const config = getAppConfig();
      expect(config.environment).toBe('test');
    });
  });

  describe('feature flags', () => {
    it('all features default to false in development', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.FEATURE_PDF_PARSING;
      delete process.env.FEATURE_RAG_LOOKUP;
      delete process.env.FEATURE_BATCH_PROCESSING;
      delete process.env.FEATURE_OBSERVABILITY;

      const config = getAppConfig();
      expect(config.features.pdfParsing).toBe(false);
      expect(config.features.ragLookup).toBe(false);
      expect(config.features.batchProcessing).toBe(false);
      expect(config.features.observability).toBe(false);
    });

    it('enables pdfParsing when flag is true', () => {
      process.env.FEATURE_PDF_PARSING = 'true';
      const config = getAppConfig();
      expect(config.features.pdfParsing).toBe(true);
    });

    it('enables ragLookup when flag is true', () => {
      process.env.FEATURE_RAG_LOOKUP = 'true';
      const config = getAppConfig();
      expect(config.features.ragLookup).toBe(true);
    });

    it('enables batchProcessing when flag is true', () => {
      process.env.FEATURE_BATCH_PROCESSING = 'true';
      const config = getAppConfig();
      expect(config.features.batchProcessing).toBe(true);
    });

    it('enables observability in production even without flag', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.FEATURE_OBSERVABILITY;
      const config = getAppConfig();
      expect(config.features.observability).toBe(true);
    });

    it('enables observability when flag is true in development', () => {
      process.env.NODE_ENV = 'development';
      process.env.FEATURE_OBSERVABILITY = 'true';
      const config = getAppConfig();
      expect(config.features.observability).toBe(true);
    });
  });

  describe('api config', () => {
    it('defaults to port 3000', () => {
      delete process.env.PORT;
      const config = getAppConfig();
      expect(config.api.port).toBe(3000);
    });

    it('reads PORT from env', () => {
      process.env.PORT = '8080';
      const config = getAppConfig();
      expect(config.api.port).toBe(8080);
    });

    it('defaults host to localhost', () => {
      delete process.env.HOST;
      const config = getAppConfig();
      expect(config.api.host).toBe('localhost');
    });

    it('reads HOST from env', () => {
      process.env.HOST = '0.0.0.0';
      const config = getAppConfig();
      expect(config.api.host).toBe('0.0.0.0');
    });

    it('cors defaults to true', () => {
      delete process.env.ENABLE_CORS;
      const config = getAppConfig();
      expect(config.api.cors).toBe(true);
    });

    it('disables cors when ENABLE_CORS=false', () => {
      process.env.ENABLE_CORS = 'false';
      const config = getAppConfig();
      expect(config.api.cors).toBe(false);
    });

    it('defaults timeout to 30000', () => {
      delete process.env.API_TIMEOUT;
      const config = getAppConfig();
      expect(config.api.timeout).toBe(30000);
    });

    it('reads API_TIMEOUT from env', () => {
      process.env.API_TIMEOUT = '60000';
      const config = getAppConfig();
      expect(config.api.timeout).toBe(60000);
    });
  });

  describe('observability config', () => {
    it('disabled by default in development', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.OBSERVABILITY_ENABLED;
      delete process.env.AI_TRACING;
      const config = getAppConfig();
      expect(config.observability.enabled).toBe(false);
      expect(config.observability.aiTracing).toBe(false);
    });

    it('enabled in production', () => {
      process.env.NODE_ENV = 'production';
      const config = getAppConfig();
      expect(config.observability.enabled).toBe(true);
      expect(config.observability.aiTracing).toBe(true);
    });

    it('reads LANGFUSE_PUBLIC_KEY', () => {
      process.env.LANGFUSE_PUBLIC_KEY = 'pk-test-123';
      const config = getAppConfig();
      expect(config.observability.langfusePublicKey).toBe('pk-test-123');
    });

    it('langfusePublicKey undefined when not set', () => {
      delete process.env.LANGFUSE_PUBLIC_KEY;
      const config = getAppConfig();
      expect(config.observability.langfusePublicKey).toBeUndefined();
    });
  });

  describe('config shape', () => {
    it('returns complete config object', () => {
      const config = getAppConfig();
      expect(config).toHaveProperty('environment');
      expect(config).toHaveProperty('features');
      expect(config).toHaveProperty('api');
      expect(config).toHaveProperty('observability');
    });
  });
});
