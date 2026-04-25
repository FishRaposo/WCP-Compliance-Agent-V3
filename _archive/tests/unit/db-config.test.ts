import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabaseConfig, DEFAULT_DATABASE_CONFIG } from '../../src/config/db-config.js';

describe('getDatabaseConfig', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns defaults when no env vars set', () => {
    delete process.env.DATABASE_URL;
    delete process.env.DB_MAX_CONNECTIONS;
    delete process.env.DB_MIGRATION_PATH;
    delete process.env.DB_LOGGING;

    const config = getDatabaseConfig();
    expect(config.url).toBe('file:./data/local.db');
    expect(config.maxConnections).toBe(10);
    expect(config.migrationPath).toBe('./migrations');
    expect(config.enableLogging).toBe(false);
  });

  it('reads DATABASE_URL from env', () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/wcp';
    const config = getDatabaseConfig();
    expect(config.url).toBe('postgresql://localhost:5432/wcp');
  });

  it('reads DB_MAX_CONNECTIONS from env', () => {
    process.env.DB_MAX_CONNECTIONS = '20';
    const config = getDatabaseConfig();
    expect(config.maxConnections).toBe(20);
  });

  it('reads DB_MIGRATION_PATH from env', () => {
    process.env.DB_MIGRATION_PATH = '/custom/migrations';
    const config = getDatabaseConfig();
    expect(config.migrationPath).toBe('/custom/migrations');
  });

  it('enables logging when DB_LOGGING=true', () => {
    process.env.DB_LOGGING = 'true';
    const config = getDatabaseConfig();
    expect(config.enableLogging).toBe(true);
  });

  it('does not enable logging when DB_LOGGING=false', () => {
    process.env.DB_LOGGING = 'false';
    const config = getDatabaseConfig();
    expect(config.enableLogging).toBe(false);
  });

  it('returns complete config object', () => {
    const config = getDatabaseConfig();
    expect(config).toHaveProperty('url');
    expect(config).toHaveProperty('maxConnections');
    expect(config).toHaveProperty('migrationPath');
    expect(config).toHaveProperty('enableLogging');
  });
});

describe('DEFAULT_DATABASE_CONFIG', () => {
  it('has correct url default', () => {
    expect(DEFAULT_DATABASE_CONFIG.url).toBe('file:./data/local.db');
  });

  it('has correct maxConnections default', () => {
    expect(DEFAULT_DATABASE_CONFIG.maxConnections).toBe(10);
  });

  it('has correct migrationPath default', () => {
    expect(DEFAULT_DATABASE_CONFIG.migrationPath).toBe('./migrations');
  });

  it('has logging disabled by default', () => {
    expect(DEFAULT_DATABASE_CONFIG.enableLogging).toBe(false);
  });
});
