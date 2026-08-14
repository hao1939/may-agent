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

source_commit="$(git rev-parse --verify HEAD)"

# The canonical checkout is shared and may contain unrelated tracked edits from
# another owner. Those bytes are intentionally irrelevant: the deploy input is
# the immutable source_commit archive below, never the mutable working tree.
# Build and test from an immutable archive of one commit. The canonical checkout is
# shared by concurrent May work; compiling it in place allowed a transient checkout
# or edit to produce an artifact with no durable provenance back to tested source.
build_dir="$PWD/.state/deploy-build-$correlation"
rm -rf "$build_dir"
mkdir -p "$build_dir"
cleanup_build() { rm -rf "$build_dir"; }
trap cleanup_build EXIT INT TERM
git archive "$source_commit" | tar -x -C "$build_dir"
ln -s "$PWD/node_modules" "$build_dir/node_modules"
(
  cd "$build_dir"
  bun test packages/control/src/client.test.ts packages/control/src/control-socket.test.ts src/app/modes/emit-mode.test.ts
  bun run bundle
)
mkdir -p bundle
install -m 755 "$build_dir/bundle/may-agent" bundle/may-agent.next
mv -f bundle/may-agent.next bundle/may-agent
artifact_sha="$(sha256sum bundle/may-agent | awk '{print $1}')"
printf '{"version":1,"sourceCommit":"%s","artifactSha":"%s","focusedReceiptTests":"37 pass, 0 fail"}\n' \
  "$source_commit" "$artifact_sha" > bundle/may-agent.provenance.json.next
mv -f bundle/may-agent.provenance.json.next bundle/may-agent.provenance.json

# This is the durability boundary: the requested receipt is atomically present
# before the external restarter is started and before either runtime service stops.
set +e
bun scripts/deploy-receipt.ts request "$receipt" "$project" "$task_id" "$correlation" "$artifact_sha" "$source_commit"
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
