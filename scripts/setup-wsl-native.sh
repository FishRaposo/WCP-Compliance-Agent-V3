#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() {
  printf '\n==> %s\n' "$1"
}

have_command() {
  command -v "$1" >/dev/null 2>&1
}

require_linux() {
  if [[ "$(uname -s)" != "Linux" ]]; then
    echo "This installer is intended for WSL/Ubuntu Linux." >&2
    exit 1
  fi
}

install_base_packages() {
  log "Installing Ubuntu packages"
  sudo apt update
  sudo apt install -y \
    build-essential curl wget gpg ca-certificates apt-transport-https pipx \
    python3.12 python3.12-venv python3-pip python3.12-dev \
    postgresql-16 postgresql-16-pgvector redis-server
}

install_poetry() {
  log "Installing Poetry with pipx"
  pipx ensurepath
  export PATH="$HOME/.local/bin:$PATH"
  if ! have_command poetry; then
    pipx install poetry
  else
    poetry --version
  fi
}

install_node() {
  local node_major=""
  if have_command node; then
    node_major="$(node --version | sed -E 's/^v([0-9]+).*/\1/')"
  fi

  if [[ -n "$node_major" && "$node_major" -ge 20 ]]; then
    log "Node.js $(node --version) is already installed"
    return
  fi

  log "Installing Node.js 20 from NodeSource"
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
}

install_elasticsearch() {
  log "Installing Elasticsearch 8.x"
  if [[ ! -f /usr/share/keyrings/elasticsearch-keyring.gpg ]]; then
    wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch \
      | sudo gpg --dearmor -o /usr/share/keyrings/elasticsearch-keyring.gpg
  fi

  echo "deb [signed-by=/usr/share/keyrings/elasticsearch-keyring.gpg] https://artifacts.elastic.co/packages/8.x/apt stable main" \
    | sudo tee /etc/apt/sources.list.d/elastic-8.x.list >/dev/null

  sudo apt update
  sudo apt install -y elasticsearch
}

configure_elasticsearch() {
  log "Configuring Elasticsearch for single-node local development"
  local config_file="/etc/elasticsearch/elasticsearch.yml"
  local temp_file
  temp_file="$(mktemp)"

  # Elasticsearch treats duplicate YAML keys as fatal. Package installs can
  # pre-populate security settings, and this script may be rerun, so normalize
  # the local-dev keys before appending the WCP block.
  sudo awk '
    /^# wcp-local-dev-start$/ { skip = 1; next }
    /^# wcp-local-dev-end$/ { skip = 0; next }
    skip == 1 { next }
    $0 ~ /^discovery\.type:/ { next }
    $0 ~ /^xpack\.security\.enabled:/ { next }
    $0 ~ /^xpack\.security\.http\.ssl\.enabled:/ { next }
    $0 ~ /^network\.host:/ { next }
    $0 ~ /^http\.port:/ { next }
    $0 ~ /^cluster\.initial_master_nodes:/ { next }
    { print }
  ' "$config_file" >"$temp_file"

  cat >>"$temp_file" <<'EOF'

# wcp-local-dev-start
discovery.type: single-node
xpack.security.enabled: false
xpack.security.http.ssl.enabled: false
network.host: 127.0.0.1
http.port: 9200
# wcp-local-dev-end
EOF

  sudo cp "$temp_file" "$config_file"
  rm -f "$temp_file"
}

start_services() {
  log "Starting PostgreSQL, Redis, and Elasticsearch"
  sudo service postgresql start
  sudo service redis-server start
  sudo service elasticsearch start
}

configure_postgres() {
  log "Creating WCP PostgreSQL role and databases"
  sudo -u postgres psql <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'wcp') THEN
    CREATE ROLE wcp WITH LOGIN PASSWORD 'wcp';
  END IF;
END
$$;
ALTER ROLE wcp CREATEDB;
SQL

  sudo -u postgres createdb -O wcp wcp 2>/dev/null || true
  sudo -u postgres createdb -O wcp wcp_test 2>/dev/null || true
  sudo -u postgres createdb -O wcp wcp_eval 2>/dev/null || true

  for database in wcp wcp_test wcp_eval; do
    sudo -u postgres psql -d "$database" -c "CREATE EXTENSION IF NOT EXISTS vector;"
  done
}

install_phoenix() {
  log "Installing Phoenix CLI in ~/.venvs/phoenix"
  python3.12 -m venv "$HOME/.venvs/phoenix"
  "$HOME/.venvs/phoenix/bin/pip" install --upgrade pip
  "$HOME/.venvs/phoenix/bin/pip" install arize-phoenix
}

install_service_dependencies() {
  log "Installing service dependencies from lockfiles"
  (cd "$ROOT_DIR/backend" && poetry install)
  (cd "$ROOT_DIR/agent" && npm ci)
  (cd "$ROOT_DIR/frontend" && npm ci)
}

print_next_steps() {
  cat <<'EOF'

Native WSL dependency setup is complete.

Start Phoenix in a separate terminal:
  ~/.venvs/phoenix/bin/phoenix serve

Run backend migrations and seed data:
  cd backend
  export DATABASE_URL=postgresql+asyncpg://wcp:wcp@localhost:5432/wcp
  export REDIS_URL=redis://localhost:6379
  export ELASTICSEARCH_URL=http://localhost:9200
  export PHASE=2
  poetry run alembic upgrade head
  poetry run python scripts/seed_all.py

Run verification:
  cd backend && poetry run pytest tests/unit tests/integration -v
  cd agent && npm run typecheck && npm test && npm run build
  cd frontend && npm run typecheck && npm run build
EOF
}

main() {
  require_linux
  install_base_packages
  install_poetry
  install_node
  install_elasticsearch
  configure_elasticsearch
  start_services
  configure_postgres
  install_phoenix
  install_service_dependencies
  print_next_steps
}

main "$@"
