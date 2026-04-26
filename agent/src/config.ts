import { z } from "zod";

const envSchema = z.object({
  BACKEND_URL: z.string().url().default("http://localhost:8000"),
  OPENAI_API_KEY: z.string().default(""),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
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
});

const raw = envSchema.parse(process.env);

// Mock LLM mode is development/CI only. Block in production.
if (raw.NODE_ENV === "production" && raw.LLM_MODE === "mock") {
  throw new Error(
    "LLM_MODE=mock is not allowed in production. Set LLM_MODE=real and provide a valid OPENAI_API_KEY before launch."
  );
}

export const config = raw;
export type Config = typeof config;

export const corsOrigins = config.CORS_ORIGINS.split(",").map((o) => o.trim());

/** True when the agent should skip real LLM calls and return deterministic mock verdicts. */
export const isMockMode = config.LLM_MODE === "mock";

/** True when authentication is disabled (development only). */
export const isAuthDisabled = config.AUTH_DISABLED === "true";
