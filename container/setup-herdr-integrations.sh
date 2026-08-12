#!/bin/bash
set -euo pipefail

export HOME="${HOME:-/app/.state}"
export PI_CODING_AGENT_DIR="${PI_CODING_AGENT_DIR:-${HOME}/.pi/agent}"

herdr_bin="${HERDR_BIN:-/usr/local/bin/may-herdr}"

# The installers require each agent's configuration root to exist. The agent
# setup scripts run first in entrypoint.sh; these mkdirs also keep this helper
# safe to run independently when repairing an older persistent state volume.
mkdir -p \
  "${HOME}/.codex" \
  "${HOME}/.claude" \
  "${PI_CODING_AGENT_DIR}"

for integration in codex claude pi; do
  "${herdr_bin}" integration install "${integration}"
done
