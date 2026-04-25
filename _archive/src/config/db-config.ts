/**
 * Database Configuration
 * 
 * Configuration for SQLite database connection and settings.
 * Used for storing audit logs and compliance analysis history.
 * 
 * @file src/config/db-config.ts
 * @see AGENTS.md for coding patterns
 * @see CONTEXT.md for architecture decisions
 */

/**
 * Database configuration interface
 */
export interface DatabaseConfig {
  /** Database connection URL */
  url: string;
  /** Maximum number of connections in the pool */
  maxConnections: number;
  /** Path to migration scripts */
  migrationPath: string;
  /** Enable query logging */
  enableLogging: boolean;
}

/**
 * Get database configuration from environment
 * @returns Database configuration
 */
export function getDatabaseConfig(): DatabaseConfig {
  return {
    url: process.env.DATABASE_URL || 'file:./data/local.db',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
    migrationPath: process.env.DB_MIGRATION_PATH || './migrations',
    enableLogging: process.env.DB_LOGGING === 'true',
  };
}

/**
 * Default database configuration
 */
export const DEFAULT_DATABASE_CONFIG: DatabaseConfig = {
  url: 'file:./data/local.db',
  maxConnections: 10,
  migrationPath: './migrations',
  enableLogging: false,
};
