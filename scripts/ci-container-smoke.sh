#!/usr/bin/env bash
set -euo pipefail

# Use a disposable instance of the candidate image, never production Compose
# or a host mount. The opaque ID is assigned only after our container is created.
image_ref="${1:?Usage: ci-container-smoke.sh IMAGE SOURCE_COMMIT}"
source_commit="${2:?Supply the full source commit embedded in the image}"
[[ "$source_commit" =~ ^[0-9a-f]{40}$ ]] || { echo 'Expected a full source commit.' >&2; exit 1; }
container_id=''
nonroot_container_id=''
root_container_id=''
runtime_container_id=''
runtime_root=''
mkdir -p test-results

cleanup() {
  result=$?
  trap - EXIT
  if [[ -n "$nonroot_container_id" ]]; then
    docker rm -f "$nonroot_container_id" >/dev/null || result=1
  fi
  if [[ -n "$root_container_id" ]]; then
    docker logs "$root_container_id" > test-results/root-container.log 2>&1 || true
    docker rm -f "$root_container_id" >/dev/null || result=1
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
    test -L /usr/local/bin/claude
    test -L /usr/local/bin/codex
    test -L /usr/local/bin/pi
    test -L /usr/local/bin/gemini
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
  --tmpfs /var/lib/mayagent:rw,uid=1000,gid=1000,mode=0755 \
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

# Root mode uses Docker's default exec identity, keeps mount ownership intact,
# and gives nginx permission to connect to ttyd's root-owned socket. Nonzero
# mount-owner UID/GID settings must never cause the root account to be remapped.
root_container_id=$(docker run --detach --network none \
  --tmpfs /app:rw,uid=1234,gid=1235,mode=0775 \
  --tmpfs /tmp:rw,mode=1777 \
  --env MAY_RUNTIME_USER=root \
  --env MAY_RUNTIME_UID=1234 --env MAY_RUNTIME_GID=1235 \
  --env MODEL_BASE_URL=http://127.0.0.1:9 --env MODEL_API_KEY=ci-unused \
  --env MAY_ARGS=--socket \
  "$image_ref")
root_ready=false
for ((attempt = 0; attempt < 30; attempt++)); do
  status=$(docker exec "$root_container_id" supervisorctl status 2>/dev/null || true)
  if grep -q '^may-agent .*RUNNING' <<<"$status" \
    && grep -q '^terminal-herdr .*RUNNING' <<<"$status" \
    && grep -q '^terminal-ttyd .*RUNNING' <<<"$status" \
    && docker exec "$root_container_id" curl -fsS --max-time 3 \
      http://127.0.0.1:8080/terminal/ >/dev/null 2>&1; then
    root_ready=true
    break
  fi
  [[ $(docker inspect --format '{{.State.Running}}' "$root_container_id") == true ]] || break
  sleep 1
done
[[ "$root_ready" == true ]] || { docker logs "$root_container_id" >&2; exit 1; }
docker exec "$root_container_id" /bin/sh -ec '
  test "$(id -u):$(id -g)" = 0:0
  test "$(getent passwd root | cut -d: -f3)" = 0
  test "$(stat -c %u:%g /app)" = 1234:1235
  test "$(stat -c %u:%g /tmp/may-agent-ttyd.sock)" = 0:0
  test "$MAY_RUNTIME_USER" = root
  herdr --session may-terminal2 status | grep -q "status: running"
'
docker exec "$root_container_id" python3 -c '
import pathlib
import subprocess

status = subprocess.run(["supervisorctl", "status"], capture_output=True, text=True).stdout
for line in status.splitlines():
    if "RUNNING" not in line:
        continue
    pid = int(line.split("pid ", 1)[1].split(",", 1)[0])
    uid = next(row for row in pathlib.Path(f"/proc/{pid}/status").read_text().splitlines()
               if row.startswith("Uid:")).split()[1:]
    assert all(value == "0" for value in uid), line
'
docker rm -f "$root_container_id" >/dev/null
root_container_id=''

# Start the real entrypoint with a custom UID/GID, custom endpoint, and
# pre-populated legacy state + SSH + root-owned Chrome profile, then run real CLI commands.
runtime_root="$(mktemp -d)"
mkdir -p "$runtime_root"/{.state/.ssh,.state/.codex/sessions,agents,projects,shared}
printf 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFixtureKey\n' > "$runtime_root/.state/.ssh/id_ed25519"
chmod 600 "$runtime_root/.state/.ssh/id_ed25519"
printf '{"id":"legacy-codex-1"}\n' > "$runtime_root/.state/.codex/sessions/legacy.jsonl"

cat > "$runtime_root/runtime-check.sh" <<'RUNTIME_CHECK'
#!/bin/bash
set -euo pipefail
test "$PWD" = /app
test "$(id -u):$(id -g)" = "1234:1235"
printf writable > /app/.runtime-write-probe
rm /app/.runtime-write-probe
test "$(stat -c '%u:%g' /app/.state/chrome-profile/Preferences)" = "1234:1235"
test -L "$HOME/.ssh"
grep -q 'IFixtureKey' "$HOME/.ssh/id_ed25519"
test -f "$HOME/.codex/sessions/legacy.jsonl"
test -L "$HOME/.pi/agent/sessions"
test -L "$HOME/.gemini/history"
test -L "$HOME/.claude/projects"
grep -q 'resume_agents_on_restore = true' "$XDG_CONFIG_HOME/herdr/config.toml"
grep -q 'base_url = "https://models.example.test/v1"' "$HOME/.codex/config.toml"
grep -q 'approval_policy = "never"' "$HOME/.codex/config.toml"
grep -q 'sandbox_mode = "danger-full-access"' "$HOME/.codex/config.toml"
grep -q 'trusted_hash = "sha256:' "$HOME/.codex/config.toml"
herdr integration status | grep -q 'pi: current'
herdr integration status | grep -q 'codex: current'
herdr integration status | grep -q 'claude: current'
pi --list-models | grep -q 'gpt-6.1-sol'
pi --list-models | grep -q 'gemini-4-argon'
test "$GOOGLE_GEMINI_BASE_URL" = "https://models.example.test"
grep -q '"baseUrl": "https://models.example.test/v1beta"' "$HOME/.pi/agent/models.json"
grep -q '"includeDirectoryTree": false' "$HOME/.gemini/settings.json"
grep -q '"enableRecursiveFileSearch": false' "$HOME/.gemini/settings.json"
grep -q 'decision = "allow"' "$HOME/.gemini/policies/full-access.toml"
RUNTIME_CHECK
chmod 755 "$runtime_root/runtime-check.sh"

runtime_container_id=$(docker create --network none --user root \
  --tmpfs /tmp:mode=1777 \
  --env MODEL_BASE_URL=https://models.example.test \
  --env MODEL_API_KEY=ci-fixture-key \
  --env GEMINI_MODEL=gemini-fixture \
  --env MAY_RUNTIME_USER=mayagent \
  --env MAY_RUNTIME_UID=1234 \
  --env MAY_RUNTIME_GID=1235 \
  --entrypoint /bin/bash \
  "$image_ref" -ec '
    mkdir -p /app/.state/chrome-profile
    printf "root-chrome-cache\n" > /app/.state/chrome-profile/Preferences
    chown -R 0:0 /app/.state/chrome-profile /app/.state/.ssh /app/.state/.codex
    exec /usr/local/bin/entrypoint.sh /runtime-check.sh
  ')
docker cp "$runtime_root/." "$runtime_container_id:/app"
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
