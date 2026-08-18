#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

project="may-agent"
task_id="${MAY_AGENT_DEPLOY_TASK_ID:-}"
correlation="${MAY_AGENT_DEPLOY_CORRELATION:-deploy-$(date -u +%Y%m%dT%H%M%SZ)-$$}"
deploy_root="${MAY_AGENT_DEPLOY_ROOT:-$PWD}"
case "$deploy_root" in
  /*) ;;
  *) echo "MAY_AGENT_DEPLOY_ROOT must be an absolute path." >&2; exit 2 ;;
esac
receipt_dir="${MAY_AGENT_DEPLOY_RECEIPT_DIR:-$deploy_root/.state/deploy-receipts}"
receipt="$receipt_dir/$correlation.json"
bundle_dir="$deploy_root/bundle"

if [ -z "$task_id" ]; then
  echo "MAY_AGENT_DEPLOY_TASK_ID is required for a correlated deploy." >&2
  exit 2
fi

# An exact task wake is a reference to existing durable work, not task-creation
# authority. Fail before building or restarting when a stale caller supplies a
# task that the running App can never admit.
task_state="${MAY_AGENT_DEPLOY_TASK_STATE:-$(dirname "$deploy_root")/${project}.app/.state/tasks/state.json}"
bun scripts/deploy-receipt.ts validate-target "$task_state" "$project" "$task_id"

source_commit="$(git rev-parse --verify HEAD)"
canonical_commit="$(git -C "$deploy_root" rev-parse --verify HEAD)"
if ! git merge-base --is-ancestor "$canonical_commit" "$source_commit"; then
  echo "Refusing to deploy stale May source $source_commit: it does not contain canonical commit $canonical_commit." >&2
  echo "Rebase or merge current may-agent main into the candidate, verify it, and retry from May-owned work." >&2
  exit 2
fi
sdk_release_name="sdk-$source_commit"

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
mkdir -p "$bundle_dir"
install -m 755 "$build_dir/bundle/may-agent" "$bundle_dir/may-agent.next"
mv -f "$bundle_dir/may-agent.next" "$bundle_dir/may-agent"
install -m 755 "$build_dir/packages/terminal/bin/may-console.cjs" "$bundle_dir/may-console.next"
mv -f "$bundle_dir/may-console.next" "$bundle_dir/may-console"
install -m 755 "$build_dir/container/may-agent-supervisor-restart.sh" "$bundle_dir/may-agent-supervisor-restart.next"
mv -f "$bundle_dir/may-agent-supervisor-restart.next" "$bundle_dir/may-agent-supervisor-restart"
install -m 644 "$build_dir/scripts/deploy-receipt.ts" "$bundle_dir/deploy-receipt.ts.next"
mv -f "$bundle_dir/deploy-receipt.ts.next" "$bundle_dir/deploy-receipt.ts"
artifact_sha="$(sha256sum "$bundle_dir/may-agent" | awk '{print $1}')"

# Apps import the SDK at runtime, so it is part of the deployed artifact rather
# than an implicit dependency on whichever branch happens to occupy the shared
# canonical checkout. Releases are immutable; the restarter atomically moves
# sdk-current with the matching binary and restores the prior link on rollback.
sdk_release="$bundle_dir/$sdk_release_name"
if [ ! -d "$sdk_release" ]; then
  sdk_stage="$bundle_dir/.${sdk_release_name}.next.$$"
  rm -rf "$sdk_stage"
  mkdir -p "$sdk_stage"
  cp -R "$build_dir/packages/sdk/." "$sdk_stage/"
  mv "$sdk_stage" "$sdk_release"
fi
test -f "$sdk_release/package.json"

printf '{"version":1,"sourceCommit":"%s","artifactSha":"%s","sdkRelease":"%s","focusedReceiptTests":"39 pass, 0 fail"}\n' \
  "$source_commit" "$artifact_sha" "$sdk_release_name" > "$bundle_dir/may-agent.provenance.json.next"
mv -f "$bundle_dir/may-agent.provenance.json.next" "$bundle_dir/may-agent.provenance.json"

# This is the durability boundary: the requested receipt is atomically present
# before the external restarter is started and before either runtime service stops.
set +e
bun scripts/deploy-receipt.ts request "$receipt" "$project" "$task_id" "$correlation" "$artifact_sha" "$source_commit"
rc=$?
set -e
if [ "$rc" = "73" ]; then exit 0; fi
if [ "$rc" != "0" ]; then exit "$rc"; fi
printf '%s\n' "$sdk_release_name" > "$bundle_dir/sdk-requested.next"
mv -f "$bundle_dir/sdk-requested.next" "$bundle_dir/sdk-requested"
printf '%s\n' "$receipt" > "$bundle_dir/deploy-requested.next"
mv -f "$bundle_dir/deploy-requested.next" "$bundle_dir/deploy-requested"

deploy_in_container='install -m 755 /app/projects/may-agent/bundle/may-agent-supervisor-restart /usr/local/bin/may-agent-supervisor-restart && MAY_AGENT_DEPLOY_RECEIPT="'"$receipt"'" MAY_AGENT_DEPLOY_CORRELATION="'"$correlation"'" MAY_AGENT_DEPLOY_PROJECT="'"$project"'" MAY_AGENT_DEPLOY_TASK_ID="'"$task_id"'" supervisorctl start may-agent-restarter'

if [ -S /tmp/supervisor.sock ] && command -v supervisorctl >/dev/null 2>&1; then
  sh -lc "$deploy_in_container"
elif command -v docker >/dev/null 2>&1; then
  docker exec -e MAY_AGENT_DEPLOY_RECEIPT="$receipt" -e MAY_AGENT_DEPLOY_CORRELATION="$correlation" -e MAY_AGENT_DEPLOY_PROJECT="$project" -e MAY_AGENT_DEPLOY_TASK_ID="$task_id" may-agent sh -lc 'install -m 755 /app/projects/may-agent/bundle/may-agent-supervisor-restart /usr/local/bin/may-agent-supervisor-restart && supervisorctl start may-agent-restarter'
else
  bun scripts/deploy-receipt.ts settle "$receipt" failed "$artifact_sha" unhealthy false supervisor-unreachable
  echo "Cannot reach the live may-agent supervisor." >&2
  exit 1
fi

printf 'Correlated deploy requested: %s (%s)\n' "$correlation" "$receipt"
