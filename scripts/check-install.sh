#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FAILED=0

ok() {
  printf 'ok   %s\n' "$1"
}

warn() {
  printf 'warn %s\n' "$1"
}

fail() {
  printf 'fail %s\n' "$1"
  FAILED=1
}

have_command() {
  command -v "$1" >/dev/null 2>&1
}

check_command() {
  local command_name="$1"
  local label="$2"
  if have_command "$command_name"; then
    ok "$label: $("$command_name" --version 2>&1 | head -n 1)"
  else
    fail "$label is missing"
  fi
}

check_node_major() {
  if ! have_command node; then
    fail "Node.js is missing"
    return
  fi

  local version major
  version="$(node --version)"
  major="$(printf '%s' "$version" | sed -E 's/^v([0-9]+).*/\1/')"
  if [[ "$major" -ge 20 ]]; then
    ok "Node.js: $version"
  else
    fail "Node.js must be >=20, found $version"
  fi
}

check_python() {
  if have_command python3.12; then
    ok "Python: $(python3.12 --version)"
  else
    fail "python3.12 is missing"
  fi

  if python3.12 -m venv --help >/dev/null 2>&1; then
    ok "python3.12-venv is available"
  else
    fail "python3.12-venv is missing"
  fi

  if python3.12 -m pip --version >/dev/null 2>&1; then
    ok "pip: $(python3.12 -m pip --version)"
  else
    fail "python3-pip is missing for python3.12"
  fi
}

check_url() {
  local url="$1"
  local label="$2"
  if curl -fsS "$url" >/dev/null 2>&1; then
    ok "$label is reachable at $url"
  else
    warn "$label is not reachable at $url"
  fi
}

check_file() {
  local path="$1"
  if [[ -f "$ROOT_DIR/$path" ]]; then
    ok "$path exists"
  else
    fail "$path is missing"
  fi
}

check_directory() {
  local path="$1"
  if [[ -d "$ROOT_DIR/$path" ]]; then
    ok "$path exists"
  else
    warn "$path is missing"
  fi
}

printf 'WCP install readiness check\n'
printf '===========================\n'

check_python
check_command poetry "Poetry"
check_node_major
check_command npm "npm"
check_command psql "PostgreSQL client"
check_command redis-cli "Redis client"
if have_command /usr/share/elasticsearch/bin/elasticsearch; then
  ok "Elasticsearch: $(/usr/share/elasticsearch/bin/elasticsearch --version 2>&1 | head -n 1)"
else
  fail "Elasticsearch binary is missing"
fi
check_command curl "curl"

check_file ".env.example"
check_file "backend/.env.example"
check_file "agent/.env.example"
check_file "frontend/.env.example"
check_file "requirements.txt"
check_file "backend/pyproject.toml"
check_file "backend/poetry.lock"
check_file "agent/package-lock.json"
check_file "frontend/package-lock.json"

check_directory "agent/node_modules"
check_directory "frontend/node_modules"

check_url "http://localhost:9200" "Elasticsearch"
if have_command redis-cli && redis-cli ping >/dev/null 2>&1; then
  ok "Redis responds to PING"
else
  warn "Redis is not responding to PING"
fi

if have_command pg_isready && pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
  ok "PostgreSQL is accepting connections"
else
  warn "PostgreSQL is not accepting localhost connections"
fi

if [[ "$FAILED" -eq 0 ]]; then
  printf '\nReady enough to install/run. Warnings may simply mean services are stopped.\n'
else
  printf '\nMissing required dependencies. Run: bash scripts/setup-wsl-native.sh\n'
fi

exit "$FAILED"
