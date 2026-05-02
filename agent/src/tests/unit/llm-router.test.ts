import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../config.js", () => {
  const mutableConfig = {
    BACKEND_URL: "http://localhost:8000",
    OPENAI_API_KEY: "",
    OPENAI_MODEL: "gpt-4o-mini",
    LLM_PROVIDER: "openai",
    ANTHROPIC_API_KEY: "",
    ANTHROPIC_MODEL: "claude-sonnet-4-20250514",
    OLLAMA_BASE_URL: "",
    OLLAMA_MODEL: "llama3.2",
    LANGFUSE_PUBLIC_KEY: "",
    LANGFUSE_SECRET_KEY: "",
    LANGFUSE_HOST: "https://cloud.langfuse.com",
    PHOENIX_COLLECTOR_ENDPOINT: "http://localhost:6006",
    SAM_GOV_API_KEY: "",
    PORT: 3000,
    NODE_ENV: "test",
    TRUST_SCORE_REVIEW_THRESHOLD: 0.6,
    TRUST_SCORE_HIGH_BAND: 0.85,
    CORS_ORIGINS: "http://localhost:5173",
    LLM_MODE: "mock",
    JWT_SECRET: "test-secret",
    AUTH_DISABLED: "false",
    REDIS_HOST: "localhost",
    REDIS_PORT: 6379,
    REDIS_PASSWORD: undefined,
  };

  (globalThis as Record<string, unknown>).__testMutableConfig = mutableConfig;

  return {
    config: mutableConfig,
  };
});

import { LLMRouter, type RoutingContext } from "../../lib/llm-router.js";

describe("LLMRouter", () => {
  let router: LLMRouter;

  beforeEach(() => {
    router = new LLMRouter();
    const cfg = (globalThis as Record<string, unknown>).__testMutableConfig as Record<string, unknown>;
    cfg.LLM_PROVIDER = "openai";
    cfg.OLLAMA_BASE_URL = "";
    cfg.ANTHROPIC_API_KEY = "";
    cfg.OPENAI_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("selectProvider", () => {
    it("selects OpenAI for compliance-critical contexts", () => {
      const ctx: RoutingContext = { complianceCritical: true };
      const cfg = router.selectProvider(ctx);

      expect(cfg.provider).toBe("openai");
    });

    it("selects Ollama for cost mode when configured", () => {
      const mutable = (globalThis as Record<string, unknown>).__testMutableConfig as Record<string, unknown>;
      mutable.OLLAMA_BASE_URL = "http://localhost:11434";

      const ctx: RoutingContext = { costMode: true };
      const cfg = router.selectProvider(ctx);

      expect(cfg.provider).toBe("ollama");
    });

    it("falls back to default when Ollama not configured for cost mode", () => {
      const mutable = (globalThis as Record<string, unknown>).__testMutableConfig as Record<string, unknown>;
      mutable.OLLAMA_BASE_URL = "";

      const ctx: RoutingContext = { costMode: true };
      // Should not throw, should fallback to default
      const cfg = router.selectProvider(ctx);

      expect(cfg.provider).toBe("openai");
    });

    it("never selects Ollama for compliance-critical even with costMode", () => {
      const mutable = (globalThis as Record<string, unknown>).__testMutableConfig as Record<string, unknown>;
      mutable.OLLAMA_BASE_URL = "http://localhost:11434";

      const ctx: RoutingContext = {
        complianceCritical: true,
        costMode: true,
      };
      const cfg = router.selectProvider(ctx);

      expect(cfg.provider).not.toBe("ollama");
      expect(cfg.provider).toBe("openai");
    });

    it("selects Anthropic for synthesis tasks when key is present", () => {
      const mutable = (globalThis as Record<string, unknown>).__testMutableConfig as Record<string, unknown>;
      mutable.ANTHROPIC_API_KEY = "sk-ant-test";

      const ctx: RoutingContext = { synthesisTask: true };
      const cfg = router.selectProvider(ctx);

      expect(cfg.provider).toBe("anthropic");
    });

    it("falls back to default for synthesis when Anthropic key missing", () => {
      const mutable = (globalThis as Record<string, unknown>).__testMutableConfig as Record<string, unknown>;
      mutable.ANTHROPIC_API_KEY = "";

      const ctx: RoutingContext = { synthesisTask: true };
      const cfg = router.selectProvider(ctx);

      expect(cfg.provider).toBe("openai");
    });

    it("uses env LLM_PROVIDER as default when no context flags set", () => {
      const mutable = (globalThis as Record<string, unknown>).__testMutableConfig as Record<string, unknown>;
      mutable.LLM_PROVIDER = "anthropic";
      mutable.ANTHROPIC_API_KEY = "sk-ant-test";

      const ctx: RoutingContext = {};
      const cfg = router.selectProvider(ctx);

      // Default path reads LLM_PROVIDER from config
      expect(cfg.provider).toBe("anthropic");
    });

    it("defaults to openai when no env or context flags set", () => {
      const ctx: RoutingContext = {};
      const cfg = router.selectProvider(ctx);

      expect(cfg.provider).toBe("openai");
    });
  });

  describe("generateWithFallback", () => {
    it("activates fallback on primary failure", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(router as any, "generate")
        .mockRejectedValueOnce(new Error("Primary failed"))
        .mockResolvedValueOnce({
          response: '{"verdict": "approved"}',
          model: "gpt-4o-mini",
          provider: "openai",
          tokens: { prompt: 100, completion: 50 },
        });

      const result = await router.generateWithFallback("test prompt", {
        costMode: true,
      });

      expect(result.tokens.prompt).toBe(100);
      expect(result.tokens.completion).toBe(50);
    });

    it("throws after all providers fail", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(router as any, "generate").mockRejectedValue(
        new Error("Provider failed")
      );

      await expect(
        router.generateWithFallback("test prompt", {})
      ).rejects.toThrow("All LLM providers failed");
    });

    it("excludes Ollama from fallback chain for compliance-critical", async () => {
      const mutable = (globalThis as Record<string, unknown>).__testMutableConfig as Record<string, unknown>;
      mutable.OLLAMA_BASE_URL = "http://localhost:11434";

      const generateSpy = vi
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(router as any, "generate")
        .mockRejectedValue(new Error("Provider failed"));

      await expect(
        router.generateWithFallback("test prompt", {
          complianceCritical: true,
        })
      ).rejects.toThrow("All LLM providers failed");

      // Verify Ollama was never tried
      const calledProviders = generateSpy.mock.calls.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ([cfg]: any[]) => cfg.provider
      );
      expect(calledProviders).not.toContain("ollama");
    });
  });
});
