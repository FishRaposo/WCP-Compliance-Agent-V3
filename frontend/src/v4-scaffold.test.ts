import { describe, expect, it } from "vitest";

import { analyticsApiRoute, analyticsPageRoute } from "./components/analytics";
import { contractsApiRoute, contractsPageRoute } from "./pages/contracts";
import { ingestionApiRoute, ingestionPageRoute } from "./pages/ingestion";
import { payrollsApiRoute, payrollsPageRoute, payrollsBulkRoute } from "./pages/payrolls";


describe("V4 frontend scaffold", () => {
  it("reserves V4 page and API routes without registering UI routes", () => {
    expect(analyticsPageRoute).toBe("/analytics");
    expect(analyticsApiRoute).toBe("/api/v4/analytics");
    expect(contractsPageRoute).toBe("/contracts");
    expect(contractsApiRoute).toBe("/api/contracts");
    expect(payrollsPageRoute).toBe("/payrolls");
    expect(payrollsApiRoute).toBe("/api/payrolls");
    expect(payrollsBulkRoute).toBe("/api/payrolls/bulk");
    expect(ingestionPageRoute).toBe("/ingestion");
    expect(ingestionApiRoute).toBe("/api/ingestion");
  });
});
