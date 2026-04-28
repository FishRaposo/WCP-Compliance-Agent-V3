#!/usr/bin/env bash
# E2E Smoke Test — verifies full stack is healthy and can process a compliance request.
#
# Usage:
#   ./scripts/e2e-smoke.sh              # AUTH_DISABLED=true assumed
#   ./scripts/e2e-smoke.sh --token JWT  # provide a JWT token for auth
#
# Requirements:
#   - Backend running on localhost:8000
#   - Agent running on localhost:3000
#   - curl and jq installed

set -euo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"
AGENT_URL="${AGENT_URL:-http://localhost:3000}"
TOKEN=""
PASSED=0
FAILED=0

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --token) TOKEN="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

AUTH_HEADER=""
if [[ -n "$TOKEN" ]]; then
  AUTH_HEADER="Authorization: Bearer $TOKEN"
fi

green() { printf '\033[0;32m%s\033[0m\n' "$1"; }
red()   { printf '\033[0;31m%s\033[0m\n' "$1"; }
info()  { printf '\033[0;36m%s\033[0m\n' "$1"; }

check() {
  local name="$1"
  local result="$2"
  if [[ "$result" == "0" ]]; then
    green "  PASS: $name"
    PASSED=$((PASSED + 1))
  else
    red "  FAIL: $name"
    FAILED=$((FAILED + 1))
  fi
}

info "=== WCP Compliance Agent — E2E Smoke Test ==="
echo ""

# 1. Backend health
info "1. Checking backend health..."
BACKEND_STATUS=$(curl -sf "${BACKEND_URL}/health" | jq -r '.status' 2>/dev/null || echo "unreachable")
check "Backend health" "$([ "$BACKEND_STATUS" = "ok" ] && echo 0 || echo 1)"

# 2. Agent health
info "2. Checking agent health..."
AGENT_STATUS=$(curl -sf "${AGENT_URL}/health" | jq -r '.status' 2>/dev/null || echo "unreachable")
check "Agent health" "$([ "$AGENT_STATUS" = "ok" ] && echo 0 || echo 1)"

# 3. Text analysis
info "3. Running text analysis..."
ANALYZE_PAYLOAD='{
  "text": "Contractor: E2E Test Corp\nProject: Federal Building\nLocation: Washington, DC\nCertified: 2026-06-01\nPayroll # 1\nWeek Ending: 2026-06-07\n\nName: John Smith\nTrade: Electrician\nHours: 40\nHourly Wage: 51.69\nFringe: 1385.20\nGross: 2067.60\nDeductions: 150.00\nNet: 1917.60"
}'

CURL_ARGS=(-sf -X POST -H "Content-Type: application/json" -d "$ANALYZE_PAYLOAD")
if [[ -n "$AUTH_HEADER" ]]; then
  CURL_ARGS+=(-H "$AUTH_HEADER")
fi

ANALYZE_RESP=$(curl "${CURL_ARGS[@]}" "${AGENT_URL}/api/analyze" 2>/dev/null || echo '{"error":"failed"}')
HAS_JOB_ID=$(echo "$ANALYZE_RESP" | jq -r 'has("job_id")' 2>/dev/null || echo "false")
HAS_VERDICT=$(echo "$ANALYZE_RESP" | jq -r 'has("verdict")' 2>/dev/null || echo "false")
HAS_TRUST=$(echo "$ANALYZE_RESP" | jq -r 'has("trust_score")' 2>/dev/null || echo "false")

check "Analyze returns job_id" "$([ "$HAS_JOB_ID" = "true" ] && echo 0 || echo 1)"
check "Analyze returns verdict" "$([ "$HAS_VERDICT" = "true" ] && echo 0 || echo 1)"
check "Analyze returns trust_score" "$([ "$HAS_TRUST" = "true" ] && echo 0 || echo 1)"

# 4. Validate trust score range
if [[ "$HAS_TRUST" == "true" ]]; then
  TRUST_SCORE=$(echo "$ANALYZE_RESP" | jq -r '.trust_score' 2>/dev/null || echo "-1")
  IN_RANGE=$(echo "$TRUST_SCORE" | awk '{print ($1 >= 0.0 && $1 <= 1.0) ? "yes" : "no"}')
  check "Trust score in [0, 1]" "$([ "$IN_RANGE" = "yes" ] && echo 0 || echo 1)"
fi

# 5. Validate verdict value
if [[ "$HAS_VERDICT" == "true" ]]; then
  VERDICT=$(echo "$ANALYZE_RESP" | jq -r '.verdict' 2>/dev/null || echo "unknown")
  VALID_VERDICT=$(echo "$VERDICT" | grep -cE '^(approved|rejected|requires_review)$' || true)
  check "Verdict is valid enum" "$([ "$VALID_VERDICT" = "1" ] && echo 0 || echo 1)"
fi

# Summary
echo ""
info "=== Results ==="
green "Passed: $PASSED"
if [[ $FAILED -gt 0 ]]; then
  red "Failed: $FAILED"
  exit 1
else
  green "All checks passed!"
  exit 0
fi
