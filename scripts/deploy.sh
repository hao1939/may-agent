#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

project="${MAY_AGENT_DEPLOY_PROJECT:-may-agent}"
task_id="${MAY_AGENT_DEPLOY_TASK_ID:-}"
correlation="${MAY_AGENT_DEPLOY_CORRELATION:-deploy-$(date -u +%Y%m%dT%H%M%SZ)-$$}"
receipt_dir="${MAY_AGENT_DEPLOY_RECEIPT_DIR:-$PWD/.state/deploy-receipts}"
receipt="$receipt_dir/$correlation.json"

if [ -z "$task_id" ]; then
  echo "MAY_AGENT_DEPLOY_TASK_ID is required for a correlated deploy." >&2
  exit 2
fi

bun run bundle
artifact_sha="$(sha256sum bundle/may-agent | awk '{print $1}')"

# This is the durability boundary: the requested receipt is atomically present
# before the external restarter is started and before either runtime service stops.
set +e
bun scripts/deploy-receipt.ts request "$receipt" "$project" "$task_id" "$correlation" "$artifact_sha"
rc=$?
set -e
if [ "$rc" = "73" ]; then exit 0; fi
if [ "$rc" != "0" ]; then exit "$rc"; fi
printf '%s\n' "$receipt" > bundle/deploy-requested.next
mv -f bundle/deploy-requested.next bundle/deploy-requested

deploy_in_container='cd /app/projects/may-agent && install -m 755 container/may-agent-supervisor-restart.sh /usr/local/bin/may-agent-supervisor-restart && MAY_AGENT_DEPLOY_RECEIPT="'"$receipt"'" MAY_AGENT_DEPLOY_CORRELATION="'"$correlation"'" MAY_AGENT_DEPLOY_PROJECT="'"$project"'" MAY_AGENT_DEPLOY_TASK_ID="'"$task_id"'" supervisorctl start may-agent-restarter'

if [ -S /tmp/supervisor.sock ] && command -v supervisorctl >/dev/null 2>&1; then
  sh -lc "$deploy_in_container"
elif command -v docker >/dev/null 2>&1; then
  docker exec -e MAY_AGENT_DEPLOY_RECEIPT="$receipt" -e MAY_AGENT_DEPLOY_CORRELATION="$correlation" -e MAY_AGENT_DEPLOY_PROJECT="$project" -e MAY_AGENT_DEPLOY_TASK_ID="$task_id" may-agent sh -lc 'cd /app/projects/may-agent && install -m 755 container/may-agent-supervisor-restart.sh /usr/local/bin/may-agent-supervisor-restart && supervisorctl start may-agent-restarter'
else
  bun scripts/deploy-receipt.ts settle "$receipt" failed "$artifact_sha" unhealthy false supervisor-unreachable
  echo "Cannot reach the live may-agent supervisor." >&2
  exit 1
fi

printf 'Correlated deploy requested: %s (%s)\n' "$correlation" "$receipt"
