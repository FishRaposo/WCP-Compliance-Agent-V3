import { describe, it, expect, vi } from "vitest";
import { generateMockWcpDecision, isMockMode } from "../../src/utils/mock-responses.js";

describe("generateMockWcpDecision", () => {
  it("should return Approved status for valid data (Electrician, 40h, $60)", () => {
    const input = "Role: Electrician, Hours: 40, Wage: $60";
    const result = generateMockWcpDecision(input);

    expect(result.status).toBe("Approved");
    expect(result.explanation).toContain("approved");
    expect(result.explanation).toContain("Electrician");
    expect(result.findings).toHaveLength(0);
    expect(result.trace).toHaveLength(5);
    expect(result.requestId).toMatch(/^mock-/);
    expect(result.timestamp).toBeDefined();
  });

  it("should return Revise status for overtime (Laborer, 45h, $27)", () => {
    const input = "Role: Laborer, Hours: 45, Wage: $27";
    const result = generateMockWcpDecision(input);

    expect(result.status).toBe("Revise");
    expect(result.findings).toContainEqual(
      expect.objectContaining({ type: "Overtime" })
    );
    expect(result.explanation).toContain("requires revision");
  });

  it("should return Reject status for invalid role (Wizard)", () => {
    const input = "Role: Wizard, Hours: 40, Wage: $50";
    const result = generateMockWcpDecision(input);

    expect(result.status).toBe("Reject");
    expect(result.findings).toContainEqual(
      expect.objectContaining({ type: "Invalid Role" })
    );
    expect(result.explanation).toContain("rejected");
  });

  it("should return Reject status for underpayment (Electrician, $20)", () => {
    const input = "Role: Electrician, Hours: 40, Wage: $20";
    const result = generateMockWcpDecision(input);

    expect(result.status).toBe("Reject");
    expect(result.findings).toContainEqual(
      expect.objectContaining({ type: "Underpay" })
    );
  });

  it("should handle case-insensitive role (electrician)", () => {
    const input = "role: electrician, hours: 20, wage: 55";
    const result = generateMockWcpDecision(input);

    expect(result.status).toBe("Approved");
  });

  it("should use default values for empty/garbage input and result in Reject", () => {
    const input = "This is just garbage text";
    const result = generateMockWcpDecision(input);

    expect(result.status).toBe("Reject");
    expect(result.findings).toContainEqual(
      expect.objectContaining({ type: "Invalid Role", detail: expect.stringContaining("UNKNOWN") })
    );
  });

  it("should handle input with dollar signs and decimals in wage/hours", () => {
    const input = "Role: Electrician, Hours: 35.5, Wage: $55.50";
    const result = generateMockWcpDecision(input);

    expect(result.status).toBe("Approved");
    expect(result.explanation).toContain("35.5");
    expect(result.explanation).toContain("55.5");
  });
});

describe("isMockMode", () => {
  it("should return true when OPENAI_API_KEY is 'mock'", () => {
    vi.stubEnv("OPENAI_API_KEY", "mock");
    expect(isMockMode()).toBe(true);
    vi.unstubAllEnvs();
  });

  it("should return true when OPENAI_API_KEY is 'mock-key'", () => {
    vi.stubEnv("OPENAI_API_KEY", "mock-key");
    expect(isMockMode()).toBe(true);
    vi.unstubAllEnvs();
  });

  it("should return false when OPENAI_API_KEY is an actual key", () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-actual-key");
    expect(isMockMode()).toBe(false);
    vi.unstubAllEnvs();
  });
});
