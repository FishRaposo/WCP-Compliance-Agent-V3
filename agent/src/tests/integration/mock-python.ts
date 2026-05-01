/**
 * Lightweight mock Python backend for agent integration tests.
 * Serves deterministic responses for /extract, /validate, /search, /decisions.
 */

import { Hono } from "hono";
import { serve } from "@hono/node-server";

const app = new Hono();

app.post("/extract", async (c) => {
  const body = await c.req.json();
  const wageMatch = String(body.text ?? "").match(/Hourly Wage:\s*([0-9.]+)/i);
  const tradeMatch = String(body.text ?? "").match(/Trade:\s*([A-Za-z ]+)/i);
  const hourlyWage = wageMatch?.[1] ? Number.parseFloat(wageMatch[1]) : 51.69;
  const trade = tradeMatch?.[1]?.trim() || "Laborer";
  return c.json({
    job_id: "mock-job-001",
    contractor: { name: "Mock Contractor", address: "", ein: "" },
    project: { name: "Mock Project", location: "Washington, DC", contract_number: "", wage_determination_number: "" },
    employees: [
      {
        name: "John Doe",
        trade_classification: trade,
        hours_worked: 40,
        overtime_hours: 0,
        hourly_wage: hourlyWage,
        fringe_benefits: 1385.20,
        gross_earnings: 2067.60,
        deductions: 200,
        net_wages: 1867.60,
      },
    ],
    certification_date: "2026-04-18",
    payroll_number: 1,
    week_ending: "2026-04-18",
  });
});

app.post("/validate", async (c) => {
  const extracted = await c.req.json();
  // Simple deterministic logic with trade-specific mock thresholds.
  const wage = extracted.employees?.[0]?.hourly_wage ?? 0;
  const trade = extracted.employees?.[0]?.trade_classification ?? "";
  const expectedWage = trade === "Plumber" ? 48.5 : 50.0;
  const passes = wage >= expectedWage;

  return c.json({
    job_id: extracted.job_id,
    checks: [
      {
        check_id: "wage_john_doe",
        check_type: "wage_check",
        employee_name: "John Doe",
        status: passes ? "pass" : "fail",
        expected_value: expectedWage,
        actual_value: wage,
        variance: passes ? 0 : expectedWage - wage,
        regulation_cite: "40 U.S.C. § 3142",
        message: passes ? "Wage meets minimum" : "Wage below minimum",
      },
    ],
    overall_status: passes ? "pass" : "fail",
    violation_count: passes ? 0 : 1,
    warning_count: 0,
    dbwd_rates_used: [],
  });
});

app.post("/search", async (c) => {
  return c.json([
    {
      chunk_id: "chunk-001",
      text: "Davis-Bacon Act requires prevailing wage rates for federal construction contracts.",
      score: 0.95,
      metadata: { trade: "Electrician", locality: "Washington, DC", regulation_cite: "40 U.S.C. § 3142" },
    },
  ]);
});

app.post("/decisions", async (c) => {
  const decision = await c.req.json();
  return c.json({
    decision_id: "mock-decision-001",
    job_id: decision.job_id,
    verdict: decision.verdict,
    trust_score: decision.trust_score,
    trust_band: decision.trust_band,
    requires_human_review: decision.requires_human_review,
    violation_count: decision.violation_count,
    warning_count: decision.warning_count,
    created_at: new Date().toISOString(),
  });
});

// V4 proxy routes — required by routes.test.ts and v4-integration.test.ts

app.get("/v4/contracts", () => new Response(null, { status: 200 }));
app.post("/v4/contracts", () => new Response(null, { status: 201 }));
app.get("/v4/contracts/:id", () => new Response(null, { status: 200 }));
app.put("/v4/contracts/:id", () => new Response(null, { status: 200 }));
app.delete("/v4/contracts/:id", () => new Response(null, { status: 200 }));
app.post("/v4/contracts/bulk", () => new Response(null, { status: 202 }));

app.get("/v4/payrolls", () => new Response(null, { status: 200 }));
app.post("/v4/payrolls", () => new Response(null, { status: 201 }));
app.get("/v4/payrolls/:id", () => new Response(null, { status: 200 }));
app.put("/v4/payrolls/:id", () => new Response(null, { status: 200 }));
app.delete("/v4/payrolls/:id", () => new Response(null, { status: 200 }));
app.post("/v4/payrolls/bulk", () => new Response(null, { status: 202 }));

app.get("/v4/ingestion/jobs", () => new Response(null, { status: 200 }));

app.get("/v4/analytics/overview", () => new Response(null, { status: 200 }));
app.get("/v4/analytics/decision-volume", () => new Response(null, { status: 200 }));
app.get("/v4/analytics/compliance", () => new Response(null, { status: 200 }));
app.get("/v4/analytics/wages", () => new Response(null, { status: 200 }));
app.get("/v4/analytics/llm", () => new Response(null, { status: 200 }));

app.post("/v4/ingestion/bulk-upload", () => new Response(null, { status: 202 }));

export function startMockBackend(port = 9999) {
  return serve({ fetch: app.fetch, port }, () => {
    console.log(`Mock Python backend running on port ${port}`);
  });
}
