#!/bin/bash
set -euo pipefail

export HOME="${HOME:-/var/lib/mayagent}"
export PI_CODING_AGENT_DIR="${PI_CODING_AGENT_DIR:-${HOME}/.pi/agent}"
gemini_home="${GEMINI_CLI_HOME:-${HOME}}/.gemini"
project_root="${PROJECT_ROOT:-/app}"

herdr_bin="${HERDR_BIN:-/usr/local/bin/may-herdr}"

# The installers require each agent's configuration root to exist. The agent
# setup scripts run first in entrypoint.sh; these mkdirs also keep this helper
# safe to run independently when repairing an older persistent state volume.
mkdir -p \
  "${HOME}/.codex" \
  "${HOME}/.claude" \
  "${PI_CODING_AGENT_DIR}" \
  "${gemini_home}/hooks"

for integration in codex claude pi; do
  "${herdr_bin}" integration install "${integration}"
done

# Install Herdr lifecycle + session-reporting hooks for Gemini CLI so Herdr
# tracks Gemini startup, working/idle/blocked state, and session resume across
# Herdr/container restarts alongside Pi & Codex.
gemini_hook_path="${gemini_home}/hooks/herdr-agent-state.sh"
cat > "${gemini_hook_path}" <<'HOOK'
#!/bin/sh
# Managed by May container Herdr integration for Gemini CLI.
set -eu

emit_and_exit() {
  printf '{}\n'
  exit 0
}

action="${1:-}"
case "$action" in
  session|working|idle|blocked|end) ;;
  *) emit_and_exit ;;
esac

[ "${HERDR_ENV:-}" = "1" ] || emit_and_exit
[ -n "${HERDR_SOCKET_PATH:-}" ] || emit_and_exit
[ -n "${HERDR_PANE_ID:-}" ] || emit_and_exit
command -v python3 >/dev/null 2>&1 || emit_and_exit

HERDR_GEMINI_ACTION="$action" python3 -c '
import json
import os
import socket
import sys
import time

action = os.environ.get("HERDR_GEMINI_ACTION", "")
pane_id = os.environ["HERDR_PANE_ID"]
socket_path = os.environ["HERDR_SOCKET_PATH"]
source = "herdr:gemini"

try:
    raw = sys.stdin.read()
    payload = json.loads(raw) if raw.strip() else {}
except Exception:
    payload = {}

if not isinstance(payload, dict):
    payload = {}

def send(method: str, params: dict) -> None:
    seq = time.time_ns()
    req = {
        "id": f"{source}:{action}:{seq}",
        "method": method,
        "params": {"pane_id": pane_id, "source": source, "agent": "gemini", "seq": seq, **params},
    }
    try:
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
            client.settimeout(0.5)
            client.connect(socket_path)
            client.sendall((json.dumps(req) + "\n").encode())
            client.recv(4096)
    except Exception:
        pass

session_id = payload.get("session_id") or payload.get("conversationId")
session_id = session_id.strip() if isinstance(session_id, str) and session_id.strip() else None
transcript_path = payload.get("transcript_path") or payload.get("transcriptPath")
transcript_path = transcript_path.strip() if isinstance(transcript_path, str) and transcript_path.strip() else None

session_fields: dict = {}
if session_id:
    session_fields["agent_session_id"] = session_id
    session_fields["resume_argv"] = ["gemini", "--resume", session_id]
if transcript_path:
    session_fields["agent_session_path"] = transcript_path

if action == "session":
    send("pane.report_agent", {"state": "idle", **session_fields})
    session_params = dict(session_fields)
    start_source = payload.get("source")
    if isinstance(start_source, str) and start_source.strip():
        session_params["session_start_source"] = start_source.strip()
    if session_id or transcript_path:
        send("pane.report_agent_session", session_params)
elif action in ("working", "idle", "blocked"):
    state_params = {"state": action, **session_fields}
    msg = payload.get("message")
    if action == "blocked" and isinstance(msg, str) and msg.strip():
        state_params["message"] = msg.strip()
    send("pane.report_agent", state_params)
elif action == "end":
    send("pane.release_agent", {})
' 2>/dev/null || true

emit_and_exit
HOOK
chmod 755 "${gemini_hook_path}"

node - "${gemini_home}/settings.json" "${gemini_home}/trusted_hooks.json" "${gemini_hook_path}" "${project_root}" <<'NODE'
const fs = require("node:fs");
const [settingsPath, trustedPath, hookPath, projectRoot] = process.argv.slice(2);
const eventSpecs = [
  ["SessionStart", "herdr-gemini-session", "session"],
  ["BeforeAgent", "herdr-gemini-working", "working"],
  ["AfterAgent", "herdr-gemini-idle", "idle"],
  ["Notification", "herdr-gemini-blocked", "blocked"],
  ["SessionEnd", "herdr-gemini-end", "end"],
];

let settings = {};
try {
  settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
} catch {}
settings.hooks ??= {};

const hookKeys = [];
for (const [eventName, hookName, action] of eventSpecs) {
  const command = `sh '${hookPath}' ${action}`;
  hookKeys.push(`${hookName}:${command}`);
  const existing = Array.isArray(settings.hooks[eventName]) ? settings.hooks[eventName] : [];
  const filtered = existing.filter((def) => {
    if (!def || !Array.isArray(def.hooks)) return true;
    return !def.hooks.some(
      (h) => h && (h.name === hookName || String(h.command || "").includes("herdr-agent-state.sh"))
    );
  });
  filtered.push({
    hooks: [
      {
        name: hookName,
        type: "command",
        command,
        timeout: 5000,
      },
    ],
  });
  settings.hooks[eventName] = filtered;
}
fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });

let trusted = {};
try {
  trusted = JSON.parse(fs.readFileSync(trustedPath, "utf8"));
} catch {}
for (const root of [projectRoot, `${projectRoot}/projects`, `${projectRoot}/worktrees`, "/app", "/tmp"]) {
  if (!root) continue;
  const list = new Set(Array.isArray(trusted[root]) ? trusted[root] : []);
  for (const key of hookKeys) {
    list.add(key);
  }
  trusted[root] = [...list];
}
fs.writeFileSync(trustedPath, `${JSON.stringify(trusted, null, 2)}\n`, { mode: 0o600 });
NODE
