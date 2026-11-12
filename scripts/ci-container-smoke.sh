#!/usr/bin/env bash
set -euo pipefail

# Use a disposable instance of the candidate image, never production Compose
# or a host mount. The opaque ID is assigned only after our container is created.
image_ref="${1:?Usage: ci-container-smoke.sh IMAGE SOURCE_COMMIT}"
source_commit="${2:?Supply the full source commit embedded in the image}"
[[ "$source_commit" =~ ^[0-9a-f]{40}$ ]] || { echo 'Expected a full source commit.' >&2; exit 1; }
container_id=''
nonroot_container_id=''
runtime_container_id=''
runtime_root=''
mkdir -p test-results

cleanup() {
  result=$?
  trap - EXIT
  if [[ -n "$nonroot_container_id" ]]; then
    docker rm -f "$nonroot_container_id" >/dev/null || result=1
  fi
  if [[ -n "$runtime_container_id" ]]; then
    docker rm -f "$runtime_container_id" >/dev/null || result=1
  fi
  if [[ -n "$container_id" ]]; then
    docker logs "$container_id" > test-results/container.log 2>&1 || true
    docker inspect "$container_id" > test-results/container.json || true
    docker cp "$container_id:/app/.state/runtime-logs" test-results/runtime-logs >/dev/null 2>&1 || true
    docker stop --timeout 15 "$container_id" >/dev/null || true
    docker rm -f "$container_id" >/dev/null || result=1
  fi
  [[ -z "$runtime_root" ]] || rm -rf "$runtime_root"
  exit "$result"
}
trap cleanup EXIT

docker run --rm --network none --read-only --entrypoint /usr/local/bin/may-agent \
  "$image_ref" --version | tee test-results/version.txt
grep -Eq "^may-agent v[^ ]+ \(${source_commit:0:8}\)$" test-results/version.txt
docker run --rm --network none --read-only --entrypoint /usr/local/bin/may-agent \
  "$image_ref" --help > test-results/help.txt
grep -q 'Usage: may-agent' test-results/help.txt

# The CLI toolchain is image-owned rather than installed below /app. Prove its
# ordinary PATH, exact manifest versions, flags, and permissions as the runtime
# user from an unrelated working directory while a fresh mount masks /app.
docker run --rm --network none --read-only --user mayagent \
  --tmpfs /app --tmpfs /tmp:mode=1777 --workdir /tmp \
  --env HOME=/tmp/may-ci-home \
  --env PI_CODING_AGENT_DIR=/tmp/may-ci-home/.pi/agent \
  --entrypoint /bin/sh \
  "$image_ref" -ec '
    manifest=/opt/may-agent-cli/package.json
    test "$(command -v claude)" = /usr/local/bin/claude
    test "$(command -v codex)" = /usr/local/bin/codex
    test "$(command -v pi)" = /usr/local/bin/pi
    test "$(command -v gemini)" = /usr/local/bin/gemini
    node --version
    npm --version
    test "$(claude --version | awk "{print \$1}")" = "$(node -p "require(\"$manifest\").dependencies[\"@anthropic-ai/claude-code\"]")"
    test "$(codex --version | awk "{print \$2}")" = "$(node -p "require(\"$manifest\").dependencies[\"@openai/codex\"]")"
    test "$(pi --version)" = "$(node -p "require(\"$manifest\").dependencies[\"@earendil-works/pi-coding-agent\"]")"
    test "$(gemini --version)" = "$(node -p "require(\"$manifest\").dependencies[\"@google/gemini-cli\"]")"
    claude --help | grep -q -- --output-format
    codex exec --help | grep -q -- --output-last-message
    pi --help | grep -q -- --provider
    /bin/bash -lec '\''
      test "$(command -v claude)" = /usr/local/bin/claude
      test "$(command -v codex)" = /usr/local/bin/codex
      test "$(command -v pi)" = /usr/local/bin/pi
      test "$(command -v gemini)" = /usr/local/bin/gemini
      claude --version
      codex --version
      pi --version
      gemini --version
    '\''
  ' | tee test-results/cli-tools.txt

# The image entrypoint is normally root so it can align a remote mount owner,
# but an explicitly non-root launch with already-matching ownership must run
# the complete supervisor stack, not only the setup helper.
nonroot_container_id=$(docker run --detach --network none --user mayagent \
  --tmpfs /app:rw,uid=1000,gid=1000,mode=0775 \
  --tmpfs /tmp:rw,uid=1000,gid=1000,mode=1777 \
  --env MODEL_BASE_URL=http://127.0.0.1:9 \
  --env MODEL_API_KEY=ci-unused \
  --env MAY_ARGS=--socket \
  "$image_ref")
nonroot_ready=false
for ((attempt = 0; attempt < 30; attempt++)); do
  status=$(docker exec "$nonroot_container_id" supervisorctl status 2>/dev/null || true)
  if grep -q '^may-agent .*RUNNING' <<<"$status" \
    && grep -q '^may-agent-web-proxy .*RUNNING' <<<"$status" \
    && grep -q '^terminal-ttyd .*RUNNING' <<<"$status"; then
    nonroot_ready=true
    break
  fi
  [[ $(docker inspect --format '{{.State.Running}}' "$nonroot_container_id") == true ]] || break
  sleep 1
done
if [[ "$nonroot_ready" != true ]]; then
  docker logs "$nonroot_container_id" >&2 || true
  exit 1
fi
docker rm -f "$nonroot_container_id" >/dev/null
nonroot_container_id=''

# Match the image user to an arbitrary installation owner, configure every
# managed CLI against one endpoint, and prove the resulting user can work from
# /app without recursively rewriting the installation.
runtime_root="$(mktemp -d)"
mkdir -p "$runtime_root"/{.state,agents,projects,shared}
cat > "$runtime_root/runtime-check.sh" <<'RUNTIME_CHECK'
#!/bin/bash
set -euo pipefail
test "$PWD" = /app
printf writable > /app/.runtime-write-probe
rm /app/.runtime-write-probe
test "$(stat -c %u /app)" = "$(id -u)"
grep -q 'base_url = "https://models.example.test/v1"' "$HOME/.codex/config.toml"
grep -q 'approval_policy = "never"' "$HOME/.codex/config.toml"
grep -q 'sandbox_mode = "danger-full-access"' "$HOME/.codex/config.toml"
node -e '
  const fs = require("fs");
  const pi = JSON.parse(fs.readFileSync(process.env.HOME + "/.pi/agent/models.json"));
  const settings = JSON.parse(fs.readFileSync(process.env.HOME + "/.pi/agent/settings.json"));
  const gemini = JSON.parse(fs.readFileSync(process.env.HOME + "/.gemini/settings.json"));
  if (pi.providers["may-openai"].baseUrl !== "https://models.example.test/v1") process.exit(1);
  if (settings.defaultProvider !== "may-openai") process.exit(1);
  if (gemini.model.name !== "gemini-fixture" || gemini.tools.sandbox !== false) process.exit(1);
'
grep -q 'decision = "allow"' "$HOME/.gemini/policies/full-access.toml"
RUNTIME_CHECK
chmod 755 "$runtime_root/runtime-check.sh"
runtime_container_id=$(docker create --network none --user root \
  --tmpfs /tmp:mode=1777 \
  --env MODEL_BASE_URL=https://models.example.test \
  --env MODEL_API_KEY=ci-fixture-key \
  --env GEMINI_MODEL=gemini-fixture \
  --env MAY_RUNTIME_UID=1234 \
  --env MAY_RUNTIME_GID=1235 \
  --entrypoint /bin/bash \
  "$image_ref" -ec '
    source /usr/local/bin/setup-runtime-user.sh
    source /usr/local/bin/setup-codex-config.sh
    source /usr/local/bin/setup-pi-config.sh
    source /usr/local/bin/setup-gemini-config.sh
    runuser -u mayagent -- /runtime-check.sh
  ')
docker cp "$runtime_root/runtime-check.sh" "$runtime_container_id:/runtime-check.sh"
docker start --attach "$runtime_container_id" | tee test-results/runtime-user.txt
docker rm "$runtime_container_id" >/dev/null
runtime_container_id=''

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

# Exercise the production client against the shipped CLI without a model call.
# Preserve source-relative imports inside this disposable test container.
for file in scripts/check-codex-goal-protocol.ts src/app/adapters/executors/codex/codex-goal-client.ts; do
  docker exec "$container_id" mkdir -p "/tmp/codex-protocol-check/$(dirname "$file")"
  docker cp "$file" "$container_id:/tmp/codex-protocol-check/$file"
done
docker exec "$container_id" timeout 30 bun /tmp/codex-protocol-check/scripts/check-codex-goal-protocol.ts \
  | tee test-results/codex-protocol.txt
