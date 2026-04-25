/**
 * Environment Variable Validation
 * 
 * Validates required and optional environment variables on startup.
 * Fails fast with clear error messages if critical variables are missing.
 */

import { config } from 'dotenv';
import pino from 'pino';

// Load environment variables
config();

// Inline logger for startup — avoids circular dep with logger.ts (which reads LOG_LEVEL set here)
const startupLog = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: 'wcp-compliance-agent', module: 'EnvValidator' },
  formatters: { level: (label) => ({ level: label }) },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Environment variable validation result
 */
interface EnvValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Required environment variables with their validation rules
 */
const REQUIRED_VARS = {
  OPENAI_API_KEY: {
    validate: (value: string) => {
      if (!value) return false;
      // Allow real API keys (sk-...) or mock key for testing
      if (value.startsWith('sk-')) {
        return value.length >= 20; // Minimum reasonable length
      }
      if (value === 'mock' || value === 'mock-key' || value === 'test-api-key') {
        return true; // Allow mock keys for testing (must match isMockMode() logic)
      }
      return false;
    },
    description: 'OpenAI API key (must start with "sk-" and be at least 20 characters, or use "mock"/"mock-key"/"test-api-key" for testing/CI)'
  }
};

/**
 * Optional environment variables with their defaults
 */
const OPTIONAL_VARS = {
  OPENAI_MODEL: {
    defaultValue: 'gpt-4o-mini',
    validate: (value: string) => {
      // Accept gpt-4*, gpt-3.5*, or o-series (o1, o3, o4-mini, etc.)
      return /^(gpt-(4|3\.5)|o\d)/.test(value);
    }
  },
  AGENT_MAX_STEPS: {
    defaultValue: '3',
    validate: (value: string) => {
      const num = parseInt(value, 10);
      return !isNaN(num) && num > 0 && num <= 10;
    }
  },
  LOG_LEVEL: {
    defaultValue: 'info',
    validate: (value: string) => {
      const validLevels = ['debug', 'info', 'warn', 'error'];
      return validLevels.includes(value);
    }
  },
  NODE_ENV: {
    defaultValue: 'development',
    validate: (value: string) => {
      const validEnvs = ['development', 'production', 'test'];
      return validEnvs.includes(value);
    }
  }
};

/**
 * Validate environment variables
 */
export function validateEnvironment(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const [varName, rules] of Object.entries(REQUIRED_VARS)) {
    const value = process.env[varName];
    if (!rules.validate(value || '')) {
      errors.push(`Missing or invalid ${varName}: ${rules.description}`);
    }
  }

  // Check optional variables and set defaults if needed
  for (const [varName, rules] of Object.entries(OPTIONAL_VARS)) {
    const value = process.env[varName];
    if (value && !rules.validate(value)) {
      warnings.push(`Invalid ${varName}: using default "${rules.defaultValue}"`);
      process.env[varName] = rules.defaultValue;
    } else if (!value) {
      process.env[varName] = rules.defaultValue;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate environment and exit if invalid
 */
export function validateEnvironmentOrExit(): void {
  const result = validateEnvironment();
  
  // Print warnings
  if (result.warnings.length > 0) {
    startupLog.warn({ warnings: result.warnings }, 'Environment warnings detected');
  }

  // Print errors and exit if invalid
  if (!result.isValid) {
    startupLog.error(
      { errors: result.errors },
      'Environment validation failed — set OPENAI_API_KEY (sk-...) or use "mock" for offline mode. See .env.example.'
    );
    process.exit(1);
  }

  startupLog.info('Environment validation passed');
}
