import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist', 'build', 'tests/e2e/**', 'tests/live/**'],
    testTimeout: 10_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'build/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        'coverage/',
        'scripts/',
        'utils/',
        'src/frontend/',
        '_archive/',
        // Live-infra adapters — tested in test:calibration (real API key required)
        // and test:retrieval (real ES/DB required). Mock paths are covered.
        'src/retrieval/vector-search.ts',
        'src/services/db-client.ts',
        // Server/API entry points — integration-tested, not unit-testable in isolation
        'src/server.ts',
        'src/app.ts',
        'src/instrumentation.ts',
        'src/entrypoints/wcp-entrypoint.ts',
        'src/pipeline/orchestrator.ts',
        'api/',
        // Type-only and re-export files — no runtime code
        'src/retrieval/types.ts',
        'src/types/index.ts',
      ],
      thresholds: {
        lines: 80,
        branches: 70,
        functions: 80,
        statements: 80
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
});
