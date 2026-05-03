import { z } from "zod";

function normalizeUrl(raw: string): string {
  return raw.includes("://") ? raw : `http://${raw}`;
}

const envSchema = z.object({
  BACKEND_URL: z.string().transform(normalizeUrl).pipe(z.string().url()).default("http://localhost:8000"),
  OPENAI_API_KEY: z.string().default(""),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  LLM_PROVIDER: z.enum(["openai", "anthropic", "ollama"]).default("openai"),
  ANTHROPIC_API_KEY: z.string().default(""),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-20250514"),
  OLLAMA_BASE_URL: z.string().default(""),
  OLLAMA_MODEL: z.string().default("llama3.2"),
  LANGFUSE_PUBLIC_KEY: z.string().default(""),
  LANGFUSE_SECRET_KEY: z.string().default(""),
  LANGFUSE_HOST: z.string().url().default("https://cloud.langfuse.com"),
  PHOENIX_COLLECTOR_ENDPOINT: z.string().url().default("http://localhost:6006"),
  SAM_GOV_API_KEY: z.string().default(""),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  TRUST_SCORE_REVIEW_THRESHOLD: z.coerce.number().default(0.6),
  TRUST_SCORE_HIGH_BAND: z.coerce.number().default(0.85),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  LLM_MODE: z.enum(["mock", "real"]).default("mock"),
  JWT_SECRET: z.string().default("change-me-before-launch"),
  AUTH_DISABLED: z.enum(["true", "false"]).default("false"),
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
});

const raw = envSchema.parse(process.env);

// Mock LLM mode is development/CI only. Block in production.
if (raw.NODE_ENV === "production" && raw.LLM_MODE === "mock") {
  throw new Error(
    "LLM_MODE=mock is not allowed in production. Set LLM_MODE=real and provide a valid OPENAI_API_KEY before launch."
  );
}

// Security validations for production environments
if (raw.NODE_ENV === "production") {
  if (raw.JWT_SECRET === "change-me-before-launch") {
    throw new Error(
      "CRITICAL: Default JWT_SECRET is not allowed in production. Set a strong, unique secret to prevent token forgery."
    );
  }

  if (raw.AUTH_DISABLED === "true") {
    throw new Error(
      "CRITICAL: AUTH_DISABLED=true is not allowed in production. Authentication must be enforced."
    );
  }
}

export const config = raw;
export type Config = typeof config;

export const corsOrigins = config.CORS_ORIGINS.split(",").map((o) => o.trim());

/** True when the agent should skip real LLM calls and return deterministic mock verdicts. */
export const isMockMode = config.LLM_MODE === "mock";

/** True when authentication is disabled (development only). */
export const isAuthDisabled = config.AUTH_DISABLED === "true";
