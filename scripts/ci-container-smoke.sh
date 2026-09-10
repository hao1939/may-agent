#!/usr/bin/env bash
set -euo pipefail

# Use a disposable instance of the candidate image, never production Compose
# or a host mount. The opaque ID is assigned only after our container is created.
image_ref="${1:?Usage: ci-container-smoke.sh IMAGE SOURCE_COMMIT}"
source_commit="${2:?Supply the full source commit embedded in the image}"
[[ "$source_commit" =~ ^[0-9a-f]{40}$ ]] || { echo 'Expected a full source commit.' >&2; exit 1; }
container_id=''
mkdir -p test-results

cleanup() {
  result=$?
  trap - EXIT
  if [[ -n "$container_id" ]]; then
    docker logs "$container_id" > test-results/container.log 2>&1 || true
    docker inspect "$container_id" > test-results/container.json || true
    docker cp "$container_id:/app/.state/runtime-logs" test-results/runtime-logs >/dev/null 2>&1 || true
    docker stop --timeout 15 "$container_id" >/dev/null || true
    docker rm -f "$container_id" >/dev/null || result=1
  fi
  exit "$result"
}
trap cleanup EXIT

docker run --rm --network none --read-only --entrypoint /usr/local/bin/may-agent \
  "$image_ref" --version | tee test-results/version.txt
grep -Eq "^may-agent v[^ ]+ \(${source_commit:0:8}\)$" test-results/version.txt
docker run --rm --network none --read-only --entrypoint /usr/local/bin/may-agent \
  "$image_ref" --help > test-results/help.txt
grep -q 'Usage: may-agent' test-results/help.txt

# Exercise the shipped binary as its normal unprivileged user. Desktop/VNC
# startup is outside this runtime smoke test and needs no display or host mount.
container_id=$(docker create --init --user mayagent --publish 127.0.0.1::8080 \
  --entrypoint /usr/local/bin/may-agent \
  --env STATE_DIR=/tmp/may-ci-state \
  --env MODEL_BASE_URL=http://127.0.0.1:9 \
  --env MODEL_API_KEY=ci-unused \
  "$image_ref" --socket --web)
# The image intentionally ships no operator-owned agents. Supply the same
# committed test agents as the daemon tests, without mounting an installation.
docker cp test/e2e/fixtures/agents "$container_id:/app/agents"
docker start "$container_id" >/dev/null
address=$(docker port "$container_id" 8080/tcp)
ready=false
for ((attempt = 0; attempt < 60; attempt++)); do
  if curl --fail --silent --max-time 3 "http://$address/api/readiness" > test-results/readiness.json \
    && jq -e '.ready == true' test-results/readiness.json >/dev/null; then
    ready=true
    break
  fi
  [[ $(docker inspect --format '{{.State.Running}}' "$container_id") == true ]] || break
  sleep 2
done
[[ "$ready" == true ]] || { echo 'Candidate daemon did not become ready.' >&2; exit 1; }
curl --fail --silent --max-time 5 "http://$address/" > test-results/index.html
grep -qi '<!doctype html>' test-results/index.html
echo 'Candidate image served its UI and answered the daemon readiness probe.'

# Reuse the protocol gate against the shipped CLI, without calling a model.
# These three files belong only to this disposable test container, not the image.
docker exec "$container_id" mkdir /tmp/codex-protocol-check
for file in check-codex-goal-protocol.ts codex-goal-protocol.ts codex-goal-protocol.snapshot.json; do
  docker cp "scripts/poc/$file" "$container_id:/tmp/codex-protocol-check/$file"
done
docker exec "$container_id" timeout 30 bun /tmp/codex-protocol-check/check-codex-goal-protocol.ts \
  | tee test-results/codex-protocol.txt
