/**
 * Unit tests for the hybrid retriever — runs in mock mode (no infra required)
 *
 * In mock mode (no ES/DB), the hybrid retriever falls back to the in-memory
 * corpus, so all tests can run without Docker.
 */

import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.OPENAI_API_KEY = "test-api-key";
  // Ensure no real DB or ES connections
  delete process.env.POSTGRES_URL;
  delete process.env.ELASTICSEARCH_URL;
});

describe("lookupDBWDRate (mock mode — in-memory fallback)", () => {
  it("resolves Electrician by exact match", async () => {
    const { lookupDBWDRate } = await import("../../src/retrieval/hybrid-retriever.js");
    const result = await lookupDBWDRate("Electrician");
    expect(result.rateInfo).not.toBeNull();
    expect(result.rateInfo?.baseRate).toBe(51.69);
    expect(result.rateInfo?.fringeRate).toBe(34.63);
    expect(result.method).toBe("in_memory");
    expect(result.confidence).toBe(1.0);
  }, 15_000);

  it("resolves Laborer by exact match", async () => {
    const { lookupDBWDRate } = await import("../../src/retrieval/hybrid-retriever.js");
    const result = await lookupDBWDRate("Laborer");
    expect(result.rateInfo?.baseRate).toBe(26.45);
  });

  it("resolves Wireman via alias to Electrician", async () => {
    const { lookupDBWDRate } = await import("../../src/retrieval/hybrid-retriever.js");
    const result = await lookupDBWDRate("Wireman");
    expect(result.rateInfo).not.toBeNull();
    expect(result.rateInfo?.trade).toBe("Electrician");
    expect(result.method).toBe("in_memory");
    expect(result.confidence).toBe(0.9);
  });

  it("resolves Pipe Fitter via alias to Plumber", async () => {
    const { lookupDBWDRate } = await import("../../src/retrieval/hybrid-retriever.js");
    const result = await lookupDBWDRate("Pipe Fitter");
    expect(result.rateInfo?.trade).toBe("Plumber");
  });

  it("returns null rateInfo for completely unknown role", async () => {
    const { lookupDBWDRate } = await import("../../src/retrieval/hybrid-retriever.js");
    const result = await lookupDBWDRate("Galactic Space Plumber");
    expect(result.rateInfo).toBeNull();
    expect(result.method).toBe("in_memory");
    expect(result.confidence).toBe(0.3);
  });

  it("resolves all 20 corpus trades by exact name", async () => {
    const { lookupDBWDRate } = await import("../../src/retrieval/hybrid-retriever.js");
    const trades = [
      "Electrician", "Laborer", "Plumber", "Carpenter", "Mason",
      "Ironworker", "Roofer", "Painter", "Boilermaker", "Sheet Metal Worker",
      "HVAC Mechanic", "Glazier", "Insulator", "Operating Engineer",
      "Truck Driver", "Concrete Worker", "Surveyor", "Tile Setter",
      "Drywall Finisher", "Sprinkler Fitter",
    ];

    for (const trade of trades) {
      const result = await lookupDBWDRate(trade);
      expect(result.rateInfo, `Expected rate info for ${trade}`).not.toBeNull();
      expect(result.rateInfo?.baseRate, `Expected baseRate > 0 for ${trade}`).toBeGreaterThan(0);
    }
  }, 60_000);

  it("returns a LookupResult with all required fields", async () => {
    const { lookupDBWDRate } = await import("../../src/retrieval/hybrid-retriever.js");
    const result = await lookupDBWDRate("Electrician");
    expect(result).toHaveProperty("rateInfo");
    expect(result).toHaveProperty("method");
    expect(result).toHaveProperty("confidence");
  });
});
