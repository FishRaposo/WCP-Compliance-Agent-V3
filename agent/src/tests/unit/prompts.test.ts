import { describe, expect, it } from "vitest";

import { wcpVerdictV1 } from "../../prompts/versions/wcp-verdict-v1.js";
import { wcpVerdictV2 } from "../../prompts/versions/wcp-verdict-v2.js";
import { promptRegistry } from "../../prompts/registry.js";

describe("Prompt registry", () => {
  it("v1 prompt template contains required variables", () => {
    expect(wcpVerdictV1.template).toContain("{{extracted_wcp}}");
    expect(wcpVerdictV1.template).toContain("{{deterministic_report}}");
    expect(wcpVerdictV1.template).toContain("{{rag_context}}");
  });

  it("v2 prompt template contains required variables", () => {
    expect(wcpVerdictV2.template).toContain("{{extracted_wcp}}");
    expect(wcpVerdictV2.template).toContain("{{deterministic_report}}");
    expect(wcpVerdictV2.template).toContain("{{rag_context}}");
  });

  it("v2 prompt enforces deterministic check ID citation", () => {
    expect(wcpVerdictV2.template).toContain("MUST NOT recompute");
    expect(wcpVerdictV2.template).toContain("referenced_check_ids");
    expect(wcpVerdictV2.template).toContain("specific check IDs");
  });

  it("local fallback returns v1 when requested", async () => {
    const prompt = await promptRegistry.getPrompt("wcp-verdict", "v1");
    expect(prompt.version).toBe("v1");
    expect(prompt.template).toContain("Davis-Bacon Act compliance expert");
  });

  it("local fallback returns v2 when requested", async () => {
    const prompt = await promptRegistry.getPrompt("wcp-verdict", "v2");
    expect(prompt.version).toBe("v2");
    expect(prompt.template).toContain("MUST NOT recompute");
  });

  it("throws for unknown version", async () => {
    await expect(
      promptRegistry.getPrompt("wcp-verdict", "v99")
    ).rejects.toThrow("not found in local registry");
  });

  it("lists local versions", async () => {
    const versions = await promptRegistry.listVersions();
    expect(versions).toContain("v1");
    expect(versions).toContain("v2");
  });
});
