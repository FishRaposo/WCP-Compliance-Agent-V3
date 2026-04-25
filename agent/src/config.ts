import { z } from "zod";

const envSchema = z.object({
  BACKEND_URL: z.string().url().default("http://localhost:8000"),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  LANGFUSE_PUBLIC_KEY: z.string().default(""),
  LANGFUSE_SECRET_KEY: z.string().default(""),
  LANGFUSE_HOST: z.string().url().default("https://cloud.langfuse.com"),
  PHOENIX_COLLECTOR_ENDPOINT: z.string().url().default("http://localhost:6006"),
  SAM_GOV_API_KEY: z.string().default(""),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  TRUST_SCORE_REVIEW_THRESHOLD: z.coerce.number().default(0.6),
});

export const config = envSchema.parse(process.env);
export type Config = typeof config;
