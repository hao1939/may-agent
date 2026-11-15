#!/bin/bash
set -e

export HOME="${HOME:-/var/lib/mayagent}"
export PROJECT_ROOT="${PROJECT_ROOT:-/app}"
export MODEL_BASE_URL="${MODEL_BASE_URL:-http://host.docker.internal:4000}"
export MODEL_API_KEY="${MODEL_API_KEY:-not-needed}"
codex_home="${CODEX_HOME:-${MAY_CODEX_HOME:-${HOME}/.codex}}"

codex_model="${CODEX_MODEL:-${OPENAI_DEFAULT_MODEL:-gpt-6.1-sol}}"
codex_reasoning_effort="${CODEX_REASONING_EFFORT:-high}"
codex_base_url="${MODEL_BASE_URL}"
codex_base_url="${codex_base_url%/}"
case "${codex_base_url}" in
  */v1) ;;
  *) codex_base_url="${codex_base_url}/v1" ;;
esac

mkdir -p "${codex_home}"
if [ -n "${STATE_DIR:-}" ] && [ -d "${STATE_DIR}/cli-state/codex" ] && [ "${codex_home}" != "${STATE_DIR}/cli-state/codex" ]; then
  for sub in sessions memories; do
    mkdir -p "${STATE_DIR}/cli-state/codex/${sub}"
    if [ ! -e "${codex_home}/${sub}" ] && [ ! -L "${codex_home}/${sub}" ]; then
      ln -sfn "${STATE_DIR}/cli-state/codex/${sub}" "${codex_home}/${sub}"
    fi
  done
  touch "${STATE_DIR}/cli-state/codex/history.jsonl"
  if [ ! -e "${codex_home}/history.jsonl" ] && [ ! -L "${codex_home}/history.jsonl" ]; then
    ln -sfn "${STATE_DIR}/cli-state/codex/history.jsonl" "${codex_home}/history.jsonl"
  fi
fi

preserved_hook_state=""
if [ -f "${codex_home}/config.toml" ]; then
  # Codex records approval for each exact hook definition under hooks.state.
  # Keep those Codex-owned hashes when refreshing our managed settings so a
  # container restart does not turn an unchanged hook back into a new hook.
  preserved_hook_state="$(awk '
    /^\[hooks\.state(\]|\.)/ { preserving = 1 }
    /^\[/ && !/^\[hooks\.state(\]|\.)/ { preserving = 0 }
    preserving { print }
  ' "${codex_home}/config.toml")"
fi

extra_project_trust=""
for root_candidate in "${PROJECT_ROOT}/projects" "${PROJECT_ROOT}/worktrees" "/tmp"; do
  if [ "${root_candidate}" != "${PROJECT_ROOT}" ]; then
    extra_project_trust="${extra_project_trust}
[projects.\"${root_candidate}\"]
trust_level = \"trusted\"
"
  fi
done

cat > "${codex_home}/config.toml" <<EOF
model_provider = "model_endpoint"
model = "${codex_model}"
model_reasoning_effort = "${codex_reasoning_effort}"
personality = "pragmatic"
check_for_update_on_startup = false
approval_policy = "never"
sandbox_mode = "danger-full-access"

[features]
hooks = true

[notice]
hide_full_access_warning = true
hide_world_writable_warning = true
hide_rate_limit_model_nudge = true

[tui]
screen_reader_detection_done = true

[model_providers.model_endpoint]
name = "Configured model endpoint"
base_url = "${codex_base_url}"
env_key = "MODEL_API_KEY"
wire_api = "responses"

[projects."${PROJECT_ROOT}"]
trust_level = "trusted"
${extra_project_trust}
EOF
if [ -n "${preserved_hook_state}" ]; then
  printf '\n%s\n' "${preserved_hook_state}" >> "${codex_home}/config.toml"
fi

if command -v codex-cli >/dev/null 2>&1; then
  codex_current_version="$(codex-cli --version 2>/dev/null | awk '{print $2}')"
elif command -v codex >/dev/null 2>&1; then
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
