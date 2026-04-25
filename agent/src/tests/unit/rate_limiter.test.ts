import { describe, expect, it } from "vitest";

describe("Rate limiter middleware", () => {
  it.todo("allows requests under the limit");
  it.todo("blocks requests exceeding the limit with 429");
  it.todo("resets count after window expires");
});
