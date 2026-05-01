import { describe, expect, it } from "vitest";

import { v4BackendApiPrefix, v4PublicApiPrefix, v4RouteMap } from "../../api/v4/index.js";
import { decisionEventStreamName, v4EventOwner } from "../../events/index.js";


describe("V4 scaffold", () => {
  it("reserves public agent routes and backend route prefix", () => {
    expect(v4PublicApiPrefix).toBe("/api");
    expect(v4BackendApiPrefix).toBe("/v4");
    expect(v4RouteMap.contracts).toBe("/api/contracts");
    expect(v4RouteMap.payrolls).toBe("/api/payrolls");
    expect(v4RouteMap.ingestion).toBe("/api/ingestion");
    expect(v4RouteMap.analytics).toBe("/api/analytics");
  });

  it("reserves the V4 decision event stream", () => {
    expect(v4EventOwner).toBe("v4");
    expect(decisionEventStreamName).toBe("wcp.decisions");
  });
});
