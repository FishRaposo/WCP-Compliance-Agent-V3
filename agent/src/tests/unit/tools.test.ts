import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../utils/http-client.js", () => ({
  httpClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

import { httpClient } from "../../utils/http-client.js";
import { extractTool } from "../../mastra/tools/extract.js";
import { validateTool } from "../../mastra/tools/validate.js";
import { persistTool } from "../../mastra/tools/persist.js";
import { searchTool } from "../../mastra/tools/search.js";
import { dbwdLookupTool } from "../../mastra/tools/dbwd_lookup.js";
import type { ExtractedWCP, TrustScoredDecision } from "../../types/index.js";

const mockExtracted: ExtractedWCP = {
  job_id: "test-001",
  contractor: { name: "Test Co", address: "", ein: "" },
  project: { name: "Test Project", location: "DC", contract_number: "", wage_determination_number: "" },
  employees: [],
  certification_date: null,
  payroll_number: null,
  week_ending: null,
};

const mockDecision: TrustScoredDecision = {
  job_id: "test-001",
  verdict: "approved",
  trust_score: 0.92,
  trust_band: "auto_approve",
  requires_human_review: false,
  violation_count: 0,
  warning_count: 0,
  llm_confidence: 0.95,
  reasoning_summary: "All checks passed.",
  citations: [],
};

describe("Mastra tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extract tool forwards text to Python /extract", async () => {
    vi.mocked(httpClient.post).mockResolvedValue(mockExtracted);
    const result = await extractTool("Role: Electrician");
    expect(httpClient.post).toHaveBeenCalledWith("/extract", { text: "Role: Electrician" });
    expect(result.job_id).toBe("test-001");
  });

  it("validate tool forwards extracted WCP to Python /validate", async () => {
    const mockReport = {
      job_id: "test-001",
      checks: [],
      overall_status: "pass",
      violation_count: 0,
      warning_count: 0,
      dbwd_rates_used: [],
    };
    vi.mocked(httpClient.post).mockResolvedValue(mockReport);
    const result = await validateTool(mockExtracted);
    expect(httpClient.post).toHaveBeenCalledWith("/validate", mockExtracted);
    expect(result.overall_status).toBe("pass");
  });

  it("dbwd_lookup tool calls Python /dbwd/{trade}/{locality}/{date}", async () => {
    const mockRate = { trade: "Electrician", locality: "DC", rate: 51.69, fringe: 14.0, effective_date: "2026-01-01", wage_determination_number: "" };
    vi.mocked(httpClient.get).mockResolvedValue(mockRate);
    await dbwdLookupTool("Electrician", "Washington, DC", "2026-01-01");
    expect(httpClient.get).toHaveBeenCalledWith(
      `/dbwd/${encodeURIComponent("Electrician")}/${encodeURIComponent("Washington, DC")}/2026-01-01`
    );
  });

  it("search tool calls Python /search with correct payload", async () => {
    vi.mocked(httpClient.post).mockResolvedValue([]);
    await searchTool("prevailing wage Electrician DC", "Electrician", "DC");
    expect(httpClient.post).toHaveBeenCalledWith("/search", {
      query: "prevailing wage Electrician DC",
      trade: "Electrician",
      locality: "DC",
      top_k: 5,
    });
  });

  it("persist tool POSTs decision to Python /decisions", async () => {
    vi.mocked(httpClient.post).mockResolvedValue({ decision_id: "dec-001" });
    const result = await persistTool(mockDecision);
    expect(httpClient.post).toHaveBeenCalledWith("/decisions", mockDecision);
    expect(result.decision_id).toBe("dec-001");
  });
});
