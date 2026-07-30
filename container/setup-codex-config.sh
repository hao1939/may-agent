#!/bin/bash
set -e

export HOME="${HOME:-/app/.state}"
export PROJECT_ROOT="${PROJECT_ROOT:-/app}"
export MODEL_BASE_URL="${MODEL_BASE_URL:-http://host.docker.internal:4000}"
export MODEL_API_KEY="${MODEL_API_KEY:-not-needed}"
codex_home="${CODEX_HOME:-${MAY_CODEX_HOME:-${HOME}/.codex}}"

codex_model="${CODEX_MODEL:-gpt-5.6-sol}"
codex_reasoning_effort="${CODEX_REASONING_EFFORT:-high}"
codex_base_url="${MODEL_BASE_URL}"
codex_base_url="${codex_base_url%/}"
case "${codex_base_url}" in
  */v1) ;;
  *) codex_base_url="${codex_base_url}/v1" ;;
esac

mkdir -p "${codex_home}"
cat > "${codex_home}/config.toml" <<EOF
model_provider = "model_endpoint"
model = "${codex_model}"
model_reasoning_effort = "${codex_reasoning_effort}"
personality = "pragmatic"
check_for_update_on_startup = false

[model_providers.model_endpoint]
name = "Configured model endpoint"
base_url = "${codex_base_url}"
env_key = "MODEL_API_KEY"
wire_api = "responses"

[projects."${PROJECT_ROOT}"]
trust_level = "trusted"
EOF

if command -v codex >/dev/null 2>&1; then
  codex_current_version="$(codex --version 2>/dev/null | awk '{print $2}')"
else
  codex_current_version="0.0.0"
fi
if command -v node >/dev/null 2>&1; then
  node - "${codex_home}/version.json" "${codex_current_version:-0.0.0}" <<'NODE'
const fs = require("node:fs");
const [file, currentVersion] = process.argv.slice(2);
let state = {};
try {
  state = JSON.parse(fs.readFileSync(file, "utf8"));
} catch {}
const latestVersion = state.latest_version || currentVersion;
state.latest_version = latestVersion;
state.dismissed_version = state.dismissed_version || latestVersion;
state.last_checked_at = state.last_checked_at || new Date(0).toISOString();
fs.writeFileSync(file, `${JSON.stringify(state)}\n`);
NODE
fi

if [ "$(id -u)" = "0" ] && id mayagent >/dev/null 2>&1; then
  chown mayagent:mayagent "${codex_home}" "${codex_home}/config.toml" "${codex_home}/version.json" 2>/dev/null || true
  [ -d "${codex_home}/tmp" ] && chown -R mayagent:mayagent "${codex_home}/tmp" 2>/dev/null || true
fi
