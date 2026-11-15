#!/bin/bash
set -e

export HOME="${HOME:-/var/lib/mayagent}"
export PROJECT_ROOT="${PROJECT_ROOT:-/app}"
claude_home="${CLAUDE_CONFIG_DIR:-${HOME}/.claude}"

mkdir -p "${claude_home}"
if [ -n "${STATE_DIR:-}" ] && [ -d "${STATE_DIR}/cli-state/claude/projects" ] && [ "${claude_home}" != "${STATE_DIR}/cli-state/claude" ]; then
  if [ ! -e "${claude_home}/projects" ] && [ ! -L "${claude_home}/projects" ]; then
    ln -sfn "${STATE_DIR}/cli-state/claude/projects" "${claude_home}/projects"
  fi
fi

node - "${claude_home}/settings.json" "${HOME}/.claude.json" "${PROJECT_ROOT}" <<'NODE'
const fs = require("node:fs");
const [file, stateFile, projectRoot] = process.argv.slice(2);
let settings = {};
try {
  settings = JSON.parse(fs.readFileSync(file, "utf8"));
} catch {}
settings.permissions ??= {};
settings.permissions.defaultMode = "bypassPermissions";
settings.skipDangerousModePermissionPrompt = true;
fs.writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });

let state = {};
try {
  state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
} catch {}
state.hasCompletedOnboarding = true;
state.bypassPermissionsModeAccepted = true;
state.projects ??= {};
for (const root of [projectRoot, `${projectRoot}/projects`, `${projectRoot}/worktrees`, "/app", "/tmp"]) {
  if (!root) continue;
  state.projects[root] = {
    ...state.projects[root],
    hasTrustDialogAccepted: true,
    hasTrustDialogHooksAccepted: true,
  };
}
fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
NODE

chmod 600 "${claude_home}/settings.json" "${HOME}/.claude.json"
if [ "$(id -u)" = "0" ] && id mayagent >/dev/null 2>&1; then
  chown mayagent:mayagent "${claude_home}" "${claude_home}/settings.json" "${HOME}/.claude.json" 2>/dev/null || true
fi
