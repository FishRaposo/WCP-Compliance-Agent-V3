/**
 * Unit tests for RRF Fusion — pure function, no external deps
 */

import { describe, it, expect } from "vitest";
import { rrfFusion } from "../../src/retrieval/rrf-fusion.js";
import type { RetrievalHit } from "../../src/retrieval/types.js";

function makeHit(tradeCode: string, score: number, source: "bm25" | "vector", rank = 0): RetrievalHit {
  return {
    tradeCode,
    jobTitle: tradeCode,
    baseRate: 50,
    fringeRate: 30,
    effectiveDate: "2024-06-01",
    wdId: `WD-${tradeCode}`,
    score,
    rank,
    source,
  };
}

describe("rrfFusion", () => {
  it("returns empty array for two empty inputs", () => {
    expect(rrfFusion([], [])).toEqual([]);
  });

  it("returns bm25 hits when vector hits are empty", () => {
    const bm25 = [makeHit("ELEC", 0.9, "bm25", 0), makeHit("LABR", 0.7, "bm25", 1)];
    const result = rrfFusion(bm25, []);
    expect(result).toHaveLength(2);
    expect(result[0].tradeCode).toBe("ELEC");
  });

  it("returns vector hits when bm25 hits are empty", () => {
    const vector = [makeHit("PLMB", 0.8, "vector", 0), makeHit("CARP", 0.6, "vector", 1)];
    const result = rrfFusion([], vector);
    expect(result).toHaveLength(2);
    expect(result[0].tradeCode).toBe("PLMB");
  });

  it("deduplicates by tradeCode and accumulates RRF scores", () => {
    const bm25 = [makeHit("ELEC", 0.9, "bm25", 0)];
    const vector = [makeHit("ELEC", 0.85, "vector", 0)];
    const result = rrfFusion(bm25, vector);
    expect(result).toHaveLength(1);
    expect(result[0].tradeCode).toBe("ELEC");
    expect(result[0].sources).toContain("bm25");
    expect(result[0].sources).toContain("vector");
    // RRF score should be sum of both contributions: 2 * (1/61)
    expect(result[0].rrfScore).toBeCloseTo(2 / 61, 5);
  });

  it("sorts by RRF score descending", () => {
    const bm25 = [makeHit("ELEC", 0.9, "bm25", 0), makeHit("LABR", 0.7, "bm25", 1)];
    const vector = [makeHit("ELEC", 0.85, "vector", 0), makeHit("PLMB", 0.8, "vector", 1)];
    const result = rrfFusion(bm25, vector);
    // ELEC appears in both -> highest RRF score
    expect(result[0].tradeCode).toBe("ELEC");
  });

  it("correctly applies RRF formula 1/(k+rank+1) with k=60", () => {
    const bm25 = [makeHit("ELEC", 1.0, "bm25", 0)];
    const result = rrfFusion(bm25, []);
    // rank 0 -> 1/(60+0+1) = 1/61
    expect(result[0].rrfScore).toBeCloseTo(1 / 61, 5);
  });

  it("handles multiple candidates with different rankings", () => {
    const bm25 = [
      makeHit("A", 1.0, "bm25", 0),
      makeHit("B", 0.9, "bm25", 1),
      makeHit("C", 0.8, "bm25", 2),
    ];
    const vector = [
      makeHit("C", 0.95, "vector", 0),
      makeHit("A", 0.85, "vector", 1),
      makeHit("D", 0.75, "vector", 2),
    ];
    const result = rrfFusion(bm25, vector);
    expect(result).toHaveLength(4); // A, B, C, D
    // A: 1/61 + 1/62 = highest (appears first in both lists)
    // C: 1/63 + 1/61 = close
    expect(result[0].tradeCode).toMatch(/A|C/);
  });
});
