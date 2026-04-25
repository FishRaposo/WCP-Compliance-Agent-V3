"""Quick verification script for Phase 1 endpoints."""

from fastapi.testclient import TestClient
from wcp_backend.main import app

client = TestClient(app)

print("Testing Phase 1 endpoints...")

# Test health
resp = client.get("/health")
assert resp.status_code == 200, f"Health failed: {resp.status_code}"
print(f"[OK] Health: {resp.json()}")

# Test extract
resp = client.post("/extract", json="Name: John Smith\nTrade: Electrician\nHours: 40\nWage: 51.69")
assert resp.status_code == 200, f"Extract failed: {resp.status_code}"
assert len(resp.json()["employees"]) == 1, "Expected 1 employee"
print(f"[OK] Extract: {len(resp.json()['employees'])} employees extracted")

# Test DBWD
resp = client.get("/dbwd/Electrician/Washington, DC/2026-01-01")
assert resp.status_code == 200, f"DBWD failed: {resp.status_code}"
assert resp.json()["rate"] == 51.69, "Wrong rate"
print(f"[OK] DBWD: rate={resp.json()['rate']}, fringe={resp.json()['fringe']}")

# Test validate
payload = {
    "job_id": "verify-001",
    "contractor": {"name": "Test", "address": "", "ein": ""},
    "project": {"name": "Test Project", "location": "Washington, DC", "contract_number": "", "wage_determination_number": ""},
    "employees": [{
        "name": "Test Worker",
        "trade_classification": "Electrician",
        "hours_worked": 40.0,
        "overtime_hours": 0.0,
        "hourly_wage": 51.69,
        "fringe_benefits": 1385.20,
        "gross_earnings": 2067.60,
        "deductions": 200.0,
        "net_wages": 1867.60
    }],
    "certification_date": "2026-01-15",
    "payroll_number": 1,
    "week_ending": "2026-01-15"
}
resp = client.post("/validate", json=payload)
assert resp.status_code == 200, f"Validate failed: {resp.status_code}"
assert resp.json()["overall_status"] == "pass", f"Expected pass, got {resp.json()['overall_status']}"
print(f"[OK] Validate: status={resp.json()['overall_status']}, checks={len(resp.json()['checks'])}")

print("\n[SUCCESS] All Phase 1 endpoints working correctly!")
