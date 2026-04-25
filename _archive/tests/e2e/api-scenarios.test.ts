/**
 * Playwright E2E Tests — 6 API Scenarios (I6)
 *
 * Tests the /api/analyze endpoint directly against all 6 frontend scenarios.
 * Validates that the pipeline returns the expected finalStatus for each.
 *
 * Requires the server to be running (npm run serve) before executing:
 *   E2E_BASE_URL=http://localhost:3000 npx playwright test
 *
 * In CI, the server is started as a background process before the job runs.
 */

import { test, expect, request } from "@playwright/test";

// ============================================================================
// Scenario definitions (mirrored from ScenarioSelector.tsx)
// ============================================================================

const SCENARIOS = [
  {
    name: "Clean — Approved",
    input: "Role: Electrician, Hours: 40, Wage: 51.69, Fringe: 34.63",
    expectedStatus: ["Approved"],
    description: "Electrician at prevailing wage, no overtime",
  },
  {
    name: "Underpayment",
    input: "Role: Electrician, Hours: 40, Wage: 45.00, Fringe: 34.63",
    expectedStatus: ["Reject", "Revise", "Pending Human Review"],
    description: "Base wage $6.69/hr below DBWD rate",
  },
  {
    name: "OT Violation",
    input: "Role: Laborer, Hours: 45, Wage: 26.45, Gross Pay: 1190.25",
    expectedStatus: ["Revise", "Reject", "Pending Human Review"],
    description: "OT hours paid at straight time instead of 1.5×",
  },
  {
    name: "Fringe Shortfall",
    input: "Role: Electrician, Hours: 40, Wage: 51.69, Fringe: 20.00",
    expectedStatus: ["Revise", "Reject", "Pending Human Review"],
    description: "Fringe benefits below prevailing rate",
  },
  {
    name: "Unknown Role",
    input: "Role: Wire Technician, Hours: 40, Wage: 40.00",
    expectedStatus: ["Revise", "Reject", "Pending Human Review"],
    description: "Trade classification not found — alias resolution test",
  },
  {
    name: "Extreme OT",
    input: "Role: Laborer, Hours: 80, Wage: 26.45",
    expectedStatus: ["Reject", "Pending Human Review"],
    description: "40h OT — triggers human review flag",
  },
];

// ============================================================================
// Tests
// ============================================================================

test.describe("WCP API — 6 Scenario E2E", () => {
  for (const scenario of SCENARIOS) {
    test(`${scenario.name}: ${scenario.description}`, async ({ baseURL }) => {
      const apiContext = await request.newContext({ baseURL });

      const response = await apiContext.post("/api/analyze", {
        data: { content: scenario.input },
        headers: { "Content-Type": "application/json" },
      });

      expect(response.status()).toBe(200);

      const body = await response.json();

      // Response must contain finalStatus
      expect(body).toHaveProperty("finalStatus");
      expect(body).toHaveProperty("traceId");
      expect(body).toHaveProperty("trust");
      expect(body.trust).toHaveProperty("score");

      // finalStatus must be one of the expected values
      expect(scenario.expectedStatus).toContain(body.finalStatus);

      // Trust score must be a valid number
      expect(typeof body.trust.score).toBe("number");
      expect(body.trust.score).toBeGreaterThanOrEqual(0);
      expect(body.trust.score).toBeLessThanOrEqual(1);

      // Audit trail must have at least 3 events (layer1, layer2, layer3)
      expect(Array.isArray(body.auditTrail)).toBe(true);
      expect(body.auditTrail.length).toBeGreaterThanOrEqual(3);

      await apiContext.dispose();
    });
  }
});

// ============================================================================
// Health endpoint
// ============================================================================

test("GET /health returns healthy status", async ({ baseURL }) => {
  const apiContext = await request.newContext({ baseURL });

  const response = await apiContext.get("/health");
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body.status).toBe("healthy");
  expect(body).toHaveProperty("timestamp");

  await apiContext.dispose();
});

// ============================================================================
// Async job endpoints (M8)
// ============================================================================

test("POST /api/jobs creates job, GET /api/jobs/:jobId returns it", async ({ baseURL }) => {
  const apiContext = await request.newContext({ baseURL });

  // Create job
  const createResponse = await apiContext.post("/api/jobs", {
    data: { content: "Role: Electrician, Hours: 40, Wage: 51.69, Fringe: 34.63" },
    headers: { "Content-Type": "application/json" },
  });

  expect(createResponse.status()).toBe(202);
  const createBody = await createResponse.json();
  expect(createBody).toHaveProperty("jobId");
  expect(createBody.status).toBe("pending");

  const { jobId } = createBody;

  // Poll until completed or failed (up to 30s)
  let jobStatus = "pending";
  let attempts = 0;
  while ((jobStatus === "pending" || jobStatus === "running") && attempts < 30) {
    await new Promise((r) => setTimeout(r, 1000));
    const pollResponse = await apiContext.get(`/api/jobs/${jobId}`);
    expect(pollResponse.status()).toBe(200);
    const pollBody = await pollResponse.json();
    jobStatus = pollBody.status;
    attempts++;
  }

  expect(["completed", "failed"]).toContain(jobStatus);

  await apiContext.dispose();
});
