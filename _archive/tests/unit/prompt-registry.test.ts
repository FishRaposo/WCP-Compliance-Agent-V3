/**
 * Unit tests for the Prompt Registry — tests in-memory fallback (no DB required)
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  PromptRegistry,
  registerInMemoryPrompt,
  type PromptTemplate,
} from "../../src/prompts/registry.js";

function makePrompt(version: number, isActive: boolean, orgId?: string): PromptTemplate {
  return {
    key: "test_prompt",
    version,
    content: `Test prompt v${version}`,
    variables: ["input"],
    modelHint: "gpt-4o-mini",
    orgId,
    isActive,
  };
}

describe("PromptRegistry (in-memory fallback)", () => {
  let registry: PromptRegistry;

  beforeEach(() => {
    registry = new PromptRegistry();
    // Seed with known prompts
    registerInMemoryPrompt(makePrompt(1, false));
    registerInMemoryPrompt(makePrompt(2, true));
  });

  it("returns the active prompt for a key", async () => {
    const prompt = await registry.getActivePrompt("test_prompt");
    expect(prompt).not.toBeNull();
    expect(prompt?.version).toBe(2);
    expect(prompt?.isActive).toBe(true);
  });

  it("returns null for unknown key", async () => {
    const prompt = await registry.getActivePrompt("nonexistent_key");
    expect(prompt).toBeNull();
  });

  it("listVersions returns all registered versions", async () => {
    const versions = await registry.listVersions("test_prompt");
    expect(versions.length).toBeGreaterThanOrEqual(2);
  });

  it("registerPrompt adds to in-memory registry", async () => {
    const v3 = makePrompt(3, false);
    await registry.registerPrompt(v3);
    const versions = await registry.listVersions("test_prompt");
    expect(versions.some((v) => v.version === 3)).toBe(true);
  });

  it("setActive updates which version is active", async () => {
    await registry.setActive("test_prompt", 1);
    const prompt = await registry.getActivePrompt("test_prompt");
    expect(prompt?.version).toBe(1);
  });

  it("org-specific prompt takes priority over global", async () => {
    registerInMemoryPrompt({ ...makePrompt(5, true, "org-abc"), content: "Org ABC prompt" });
    const prompt = await registry.getActivePrompt("test_prompt", "org-abc");
    expect(prompt?.content).toBe("Org ABC prompt");
  });

  it("falls back to global when org has no prompt", async () => {
    const prompt = await registry.getActivePrompt("test_prompt", "unknown-org");
    expect(prompt?.version).toBe(2); // global active version
  });
});

describe("resolvePrompt", () => {
  it("returns prompt content string for wcp_verdict", async () => {
    const { resolvePrompt } = await import("../../src/prompts/resolver.js");
    const content = await resolvePrompt("wcp_verdict");
    expect(typeof content).toBe("string");
    expect(content!.length).toBeGreaterThan(50);
  });

  it("returns null for unknown key", async () => {
    const { resolvePrompt } = await import("../../src/prompts/resolver.js");
    const content = await resolvePrompt("this_does_not_exist_xyz");
    expect(content).toBeNull();
  });

  it("wcp_verdict content includes CRITICAL CONSTRAINT text", async () => {
    const { resolvePrompt } = await import("../../src/prompts/resolver.js");
    const content = await resolvePrompt("wcp_verdict");
    expect(content).toContain("MUST NOT");
  });
});
