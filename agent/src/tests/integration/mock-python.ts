/**
 * Lightweight mock Python backend for agent integration tests.
 * Serves deterministic responses for /extract, /validate, /search, /decisions.
 */

import { Hono } from "hono";
import { serve } from "@hono/node-server";

const app = new Hono();

app.post("/extract", async (c) => {
  const body = await c.req.json();
  return c.json({
    job_id: "mock-job-001",
    contractor: { name: "Mock Contractor", address: "", ein: "" },
    project: { name: "Mock Project", location: "Washington, DC", contract_number: "", wage_determination_number: "" },
    employees: [
      {
        name: "John Doe",
        trade_classification: body.text?.includes("Electrician") ? "Electrician" : "Laborer",
        hours_worked: 40,
        overtime_hours: 0,
        hourly_wage: 51.69,
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
  // Simple deterministic logic: if wage >= 50, pass; else fail
  const wage = extracted.employees?.[0]?.hourly_wage ?? 0;
  const passes = wage >= 50;

  return c.json({
    job_id: extracted.job_id,
    checks: [
      {
        check_id: "wage_john_doe",
        check_type: "wage_check",
        employee_name: "John Doe",
        status: passes ? "pass" : "fail",
        expected_value: 50.0,
        actual_value: wage,
        variance: passes ? 0 : 50 - wage,
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

export function startMockBackend(port = 9999) {
  return serve({ fetch: app.fetch, port }, () => {
    console.log(`Mock Python backend running on port ${port}`);
  });
}
