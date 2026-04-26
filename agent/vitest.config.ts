import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    globalSetup: "./src/tests/setup/global-setup.ts",
    setupFiles: ["./src/tests/setup/env-setup.ts"],
    testTimeout: 15_000,
  },
  resolve: {
    conditions: ["node"],
  },
});
