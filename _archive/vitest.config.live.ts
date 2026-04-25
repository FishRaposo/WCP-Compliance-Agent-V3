/**
 * Vitest config for live API tests (requires real OPENAI_API_KEY).
 *
 * Usage:
 *   $env:OPENAI_API_KEY="sk-proj-..."
 *   npx vitest run --config vitest.config.live.ts
 *   npx vitest run --config vitest.config.live.ts tests/live/smoke.test.ts
 */

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { config } from 'dotenv';

config(); // load .env before test collection

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // No setupFiles — live tests use the real API key from the environment,
    // not the mock key injected by tests/setup.ts
    include: ['tests/live/**/*.{test,spec}.{js,ts}'],
    testTimeout: 60_000,
    hookTimeout: 660_000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
