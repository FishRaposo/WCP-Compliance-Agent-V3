import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LLMRouter, type RoutingContext } from "../../lib/llm-router.js";

describe("LLMRouter", () => {
  let router: LLMRouter;
  const savedEnv = { ...process.env };

  beforeEach(() => {
    router = new LLMRouter();
    // Reset env to known state
    delete process.env.LLM_PROVIDER;
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.ANTHROPIC_API_KEY;
    process.env.OPENAI_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env = { ...savedEnv };
    vi.restoreAllMocks();
  });

  describe("selectProvider", () => {
    it("selects OpenAI for compliance-critical contexts", () => {
      const ctx: RoutingContext = { complianceCritical: true };
      const cfg = router.selectProvider(ctx);

      expect(cfg.provider).toBe("openai");
    });

    it("selects Ollama for cost mode when configured", () => {
      process.env.OLLAMA_BASE_URL = "http://localhost:11434";

      const ctx: RoutingContext = { costMode: true };
      const cfg = router.selectProvider(ctx);

      expect(cfg.provider).toBe("ollama");
    });

    it("falls back to default when Ollama not configured for cost mode", () => {
      delete process.env.OLLAMA_BASE_URL;

      const ctx: RoutingContext = { costMode: true };
      // Should not throw, should fallback to default
      const cfg = router.selectProvider(ctx);

      expect(cfg.provider).toBe("openai");
    });

    it("never selects Ollama for compliance-critical even with costMode", () => {
      process.env.OLLAMA_BASE_URL = "http://localhost:11434";

      const ctx: RoutingContext = {
        complianceCritical: true,
        costMode: true,
      };
      const cfg = router.selectProvider(ctx);

      expect(cfg.provider).not.toBe("ollama");
      expect(cfg.provider).toBe("openai");
    });

    it("selects Anthropic for synthesis tasks when key is present", () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-test";

      const ctx: RoutingContext = { synthesisTask: true };
      const cfg = router.selectProvider(ctx);

      expect(cfg.provider).toBe("anthropic");
    });

    it("falls back to default for synthesis when Anthropic key missing", () => {
      process.env.ANTHROPIC_API_KEY = "";

      const ctx: RoutingContext = { synthesisTask: true };
      const cfg = router.selectProvider(ctx);

      expect(cfg.provider).toBe("openai");
    });

    it("uses env LLM_PROVIDER as default when no context flags set", () => {
      process.env.LLM_PROVIDER = "anthropic";
      process.env.ANTHROPIC_API_KEY = "sk-ant-test";

      const ctx: RoutingContext = {};
      const cfg = router.selectProvider(ctx);

      // Default path reads LLM_PROVIDER from env
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
      vi.spyOn(router as any, "generate").mockRejectedValue(
        new Error("Provider failed")
      );

      await expect(
        router.generateWithFallback("test prompt", {})
      ).rejects.toThrow("All LLM providers failed");
    });

    it("excludes Ollama from fallback chain for compliance-critical", async () => {
      process.env.OLLAMA_BASE_URL = "http://localhost:11434";

      const generateSpy = vi
        .spyOn(router as any, "generate")
        .mockRejectedValue(new Error("Provider failed"));

      await expect(
        router.generateWithFallback("test prompt", {
          complianceCritical: true,
        })
      ).rejects.toThrow("All LLM providers failed");

      // Verify Ollama was never tried
      const calledProviders = generateSpy.mock.calls.map(
        ([cfg]: any[]) => cfg.provider
      );
      expect(calledProviders).not.toContain("ollama");
    });
  });
});
