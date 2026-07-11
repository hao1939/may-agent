#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

bun run bundle

deploy_in_container='cd /app/projects/may-agent && if grep -q MAY_AGENT_DEPLOY_MARKER /usr/local/bin/may-agent-supervisor-restart 2>/dev/null; then touch bundle/deploy-requested && supervisorctl start may-agent-restarter; else echo "live may-agent-restarter does not support staged deploy; recreate the container from the updated image first." >&2; exit 1; fi'

if [ -S /tmp/supervisor.sock ] && command -v supervisorctl >/dev/null 2>&1; then
  sh -lc "$deploy_in_container"
  exit 0
fi

if command -v docker >/dev/null 2>&1; then
  docker exec may-agent sh -lc "$deploy_in_container"
  exit 0
fi

echo "Cannot reach the live may-agent supervisor. Run this from a shell with Docker access or from inside the live may-agent container." >&2
exit 1
