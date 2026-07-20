#!/bin/bash
set -e

export HOME="${HOME:-/app/.state}"
export PROJECT_ROOT="${PROJECT_ROOT:-/app}"
export LITELLM_API_KEY="${LITELLM_API_KEY:-not-needed}"

codex_model="${CODEX_MODEL:-gpt-5.5}"
codex_base_url="${CODEX_BASE_URL:-${MODEL_BASE_URL:-http://host.docker.internal:4000}}"
codex_base_url="${codex_base_url%/}"
case "${codex_base_url}" in
  */v1) ;;
  *) codex_base_url="${codex_base_url}/v1" ;;
esac

mkdir -p "${HOME}/.codex"
cat > "${HOME}/.codex/config.toml" <<EOF
model_provider = "litellm"
model = "${codex_model}"
model_reasoning_effort = "high"
personality = "pragmatic"
check_for_update_on_startup = false

[model_providers.litellm]
name = "LiteLLM"
base_url = "${codex_base_url}"
env_key = "LITELLM_API_KEY"
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
  node - "${HOME}/.codex/version.json" "${codex_current_version:-0.0.0}" <<'NODE'
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
  chown mayagent:mayagent "${HOME}/.codex" "${HOME}/.codex/config.toml" "${HOME}/.codex/version.json" 2>/dev/null || true
  [ -d "${HOME}/.codex/tmp" ] && chown -R mayagent:mayagent "${HOME}/.codex/tmp" 2>/dev/null || true
fi
