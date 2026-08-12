#!/bin/bash
set -euo pipefail

export HOME="${HOME:-/app/.state}"
export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-${HOME}/.config}"
export XDG_STATE_HOME="${XDG_STATE_HOME:-${HOME}/.local/state}"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-${HOME}/.local/run}"
export PI_CODING_AGENT_DIR="${PI_CODING_AGENT_DIR:-${HOME}/.pi/agent}"

herdr_bin="${HERDR_BIN:-herdr}"
herdr_config_path="${HERDR_CONFIG_PATH:-${XDG_CONFIG_HOME}/herdr/config.toml}"

# The installers require each agent's configuration root to exist. The agent
# setup scripts run first in entrypoint.sh; these mkdirs also keep this helper
# safe to run independently when repairing an older persistent state volume.
mkdir -p \
  "${HOME}/.codex" \
  "${HOME}/.claude" \
  "${PI_CODING_AGENT_DIR}" \
  "$(dirname "${herdr_config_path}")" \
  "${XDG_STATE_HOME}" \
  "${XDG_RUNTIME_DIR}"

# Pin the required terminal and restore behavior instead of relying on Herdr's
# defaults. Preserve all unrelated user configuration and update idempotently.
node - "${herdr_config_path}" <<'NODE'
const fs = require("node:fs");
const [file] = process.argv.slice(2);
let source = "";
try {
  source = fs.readFileSync(file, "utf8");
} catch {}

const lines = source.split(/\r?\n/);

function setSetting(section, setting, value) {
  const sectionPattern = new RegExp(`^\\s*\\[${section}\\]\\s*(?:#.*)?$`);
  const settingPattern = new RegExp(`^\\s*${setting}\\s*=`);
  const sectionHeader = lines.findIndex((line) => sectionPattern.test(line));

  if (sectionHeader === -1) {
    while (lines.at(-1) === "") lines.pop();
    if (lines.length > 0) lines.push("");
    lines.push(`[${section}]`, `${setting} = ${value}`);
    return;
  }

  let sectionEnd = lines.length;
  for (let index = sectionHeader + 1; index < lines.length; index += 1) {
    if (/^\s*\[.*\]\s*(?:#.*)?$/.test(lines[index])) {
      sectionEnd = index;
      break;
    }
  }
  const settingIndex = lines.findIndex(
    (line, index) => index > sectionHeader
      && index < sectionEnd
      && settingPattern.test(line),
  );
  if (settingIndex === -1) lines.splice(sectionHeader + 1, 0, `${setting} = ${value}`);
  else lines[settingIndex] = `${setting} = ${value}`;
}

// Herdr's readiness handshake uses interactive editing keys. Debian's /bin/sh
// is dash and treats those bytes literally, corrupting `agent start` commands.
setSetting("terminal", "default_shell", JSON.stringify("/bin/bash"));
setSetting("session", "resume_agents_on_restore", "true");

fs.writeFileSync(file, `${lines.join("\n").replace(/\n*$/, "")}\n`, { mode: 0o600 });
NODE
chmod 600 "${herdr_config_path}"

for integration in codex claude pi; do
  "${herdr_bin}" integration install "${integration}"
done
