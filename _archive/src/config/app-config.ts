/**
 * Application Configuration
 * 
 * Main application configuration including environment settings,
 * feature flags, and observability configuration.
 * 
 * @file src/config/app-config.ts
 * @see AGENTS.md for coding patterns
 * @see CONTEXT.md for architecture decisions
 */

/**
 * Application environment type
 */
export type Environment = 'development' | 'staging' | 'production' | 'test';

/**
 * Feature flags interface
 */
export interface FeatureFlags {
  /** Enable PDF parsing */
  pdfParsing: boolean;
  /** Enable RAG-based DBWD lookup */
  ragLookup: boolean;
  /** Enable batch processing */
  batchProcessing: boolean;
  /** Enable observability tracing */
  observability: boolean;
}

/**
 * API configuration interface
 */
export interface ApiConfig {
  /** API port */
  port: number;
  /** API host */
  host: string;
  /** Enable CORS */
  cors: boolean;
  /** Request timeout (ms) */
  timeout: number;
  /** Maximum content length (chars) */
  maxContentLength: number;
}

/**
 * Observability configuration interface
 */
export interface ObservabilityConfig {
  /** Enable observability */
  enabled: boolean;
  /** Langfuse public key (optional) */
  langfusePublicKey?: string;
  /** Enable AI tracing */
  aiTracing: boolean;
}

/**
 * Application configuration interface
 */
export interface AppConfig {
  /** Current environment */
  environment: Environment;
  /** Feature flags */
  features: FeatureFlags;
  /** API configuration */
  api: ApiConfig;
  /** Observability configuration */
  observability: ObservabilityConfig;
}

/**
 * Get application configuration from environment
 * @returns Application configuration
 */
export function getAppConfig(): AppConfig {
  const environment = (process.env.NODE_ENV || 'development') as Environment;
  
  return {
    environment,
    features: {
      pdfParsing: process.env.FEATURE_PDF_PARSING === 'true',
      ragLookup: process.env.FEATURE_RAG_LOOKUP === 'true',
      batchProcessing: process.env.FEATURE_BATCH_PROCESSING === 'true',
      observability: process.env.FEATURE_OBSERVABILITY === 'true' || environment === 'production',
    },
    api: {
      port: parseInt(process.env.PORT || '3000', 10),
      host: process.env.HOST || 'localhost',
      cors: process.env.ENABLE_CORS !== 'false',
      timeout: parseInt(process.env.API_TIMEOUT || '30000', 10),
      maxContentLength: parseInt(process.env.MAX_CONTENT_LENGTH || '10000', 10),
    },
    observability: {
      enabled: process.env.OBSERVABILITY_ENABLED === 'true' || environment === 'production',
      langfusePublicKey: process.env.LANGFUSE_PUBLIC_KEY,
      aiTracing: process.env.AI_TRACING === 'true' || environment === 'production',
    },
  };
}

/**
 * Default application configuration
 */
export const DEFAULT_APP_CONFIG: AppConfig = {
  environment: 'development',
  features: {
    pdfParsing: false,
    ragLookup: false,
    batchProcessing: false,
    observability: false,
  },
  api: {
    port: 3000,
    host: 'localhost',
    cors: true,
    timeout: 30000,
    maxContentLength: 10000,
  },
  observability: {
    enabled: false,
    aiTracing: false,
  },
};
