#!/usr/bin/env bash
# Sync pi-coding-agent tool source files into may-agent.
#
# Copies the core coding tools (edit, write, truncate, path-utils, edit-diff)
# from pi-coding-agent source. Applies minimal patches:
#   - @sinclair/typebox → @mariozechner/pi-ai (re-exports the same types)
#   - bash.ts: inlines shell utilities (upstream depends on SettingsManager)
#   - read.ts: maintained manually (upstream depends on photon-node for images)
#
# Run: ./scripts/sync-pi-tools.sh
# Called automatically by: npm run build (via prebuild hook)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

PI_TOOLS="${PI_TOOLS_SRC:-/home/hao/pi-mono/packages/coding-agent/src/core/tools}"
TARGET="$PROJECT_ROOT/src/lib/tools"

if [ ! -d "$PI_TOOLS" ]; then
  echo "ERROR: pi-coding-agent tools not found at $PI_TOOLS"
  echo "Set PI_TOOLS_SRC env var to override."
  exit 1
fi

mkdir -p "$TARGET"

# Common sed: rewrite @sinclair/typebox imports to @mariozechner/pi-ai
TYPEBOX_SED='s|from "@sinclair/typebox"|from "@mariozechner/pi-ai"|g'

# Files copied with only the typebox import rewrite
for f in truncate.ts path-utils.ts edit-diff.ts edit.ts write.ts; do
  sed "$TYPEBOX_SED" "$PI_TOOLS/$f" > "$TARGET/$f"
done

# bash.ts — typebox rewrite + inline shell utilities
sed -e "$TYPEBOX_SED" \
    -e 's|import { getShellConfig, getShellEnv, killProcessTree } from "../../utils/shell.js";|// Inlined shell utilities (may-agent runs on Linux/Docker only)\
function getShellConfig(): { shell: string; args: string[] } {\
	return { shell: "/bin/bash", args: ["-c"] };\
}\
\
function getShellEnv(): NodeJS.ProcessEnv {\
	return { ...process.env };\
}\
\
function killProcessTree(pid: number): void {\
	try {\
		process.kill(-pid, "SIGKILL");\
	} catch {\
		try { process.kill(pid, "SIGKILL"); } catch { /* already dead */ }\
	}\
}|' "$PI_TOOLS/bash.ts" > "$TARGET/bash.ts"

# read.ts is maintained manually — do NOT overwrite
# (upstream depends on image-resize.js and mime.js from photon-node)

echo "Synced pi-coding-agent tools to $TARGET"
echo "Verbatim: truncate.ts path-utils.ts edit-diff.ts edit.ts write.ts"
echo "Patched:  bash.ts"
echo "Manual:   read.ts (not touched)"
