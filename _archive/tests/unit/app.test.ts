import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApp } from "../../src/app.js";
import * as wcpEntrypoint from "../../src/entrypoints/wcp-entrypoint.js";

// Mock the entrypoint to avoid running the full pipeline
vi.mock("../../src/entrypoints/wcp-entrypoint.js", () => ({
  generateWcpDecision: vi.fn().mockResolvedValue({
    traceId: "test-trace",
    finalStatus: "Approved",
    trust: { score: 1.0, band: "auto" },
    humanReview: { required: false },
    auditTrail: [],
  }),
}));

describe("App Input Validation", () => {
  let app: any;

  beforeEach(() => {
    app = createApp();
    vi.clearAllMocks();
  });

  it("should return 400 if content is missing", async () => {
    const res = await app.request("/analyze", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toBe("Content is required");
  });

  it("should return 400 if content is not a string", async () => {
    const res = await app.request("/analyze", {
      method: "POST",
      body: JSON.stringify({ content: 123 }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toBe("Content must be a string");
  });

  it("should return 400 if content exceeds maximum length", async () => {
    const longContent = "a".repeat(10001);
    const res = await app.request("/analyze", {
      method: "POST",
      body: JSON.stringify({ content: longContent }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error.message).toMatch(/too long|maximum length/i);
  });

  it("should proceed if content is valid and within length limit", async () => {
    const validContent = "a".repeat(100);
    const res = await app.request("/analyze", {
      method: "POST",
      body: JSON.stringify({ content: validContent }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(200);
    expect(wcpEntrypoint.generateWcpDecision).toHaveBeenCalled();
  });
});
