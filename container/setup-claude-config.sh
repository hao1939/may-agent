#!/bin/bash
set -e

export HOME="${HOME:-/app/.state}"
claude_home="${CLAUDE_CONFIG_DIR:-${HOME}/.claude}"

mkdir -p "${claude_home}"
node - "${claude_home}/settings.json" <<'NODE'
const fs = require("node:fs");
const [file] = process.argv.slice(2);
let settings = {};
try {
  settings = JSON.parse(fs.readFileSync(file, "utf8"));
} catch {}
settings.permissions ??= {};
settings.permissions.defaultMode = "bypassPermissions";
settings.skipDangerousModePermissionPrompt = true;
fs.writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
NODE

chmod 600 "${claude_home}/settings.json"
if [ "$(id -u)" = "0" ] && id mayagent >/dev/null 2>&1; then
  chown mayagent:mayagent "${claude_home}" "${claude_home}/settings.json" 2>/dev/null || true
fi
