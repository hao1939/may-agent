#!/usr/bin/env bash
set -euo pipefail

SSH_TARGET="${SSH_TARGET:-devbox}"
REPO_URL="${REPO_URL:-git@github.com:hao1939/aks-rp-e2e.git}"
IMAGE="${IMAGE:-localhost/may-agent:latest}"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-aks-rp-e2e}"
REMOTE_ROOT="${REMOTE_ROOT:-/home/hayua/may-agent-aks-rp-e2e}"
REMOTE_PROJECT_DIR="${REMOTE_PROJECT_DIR:-$REMOTE_ROOT/projects/aks-rp-e2e}"
WEB_PORT="${WEB_PORT:-18080}"
LITELLM_PORT="${LITELLM_PORT:-14000}"
SYNC_IMAGE="${SYNC_IMAGE:-auto}" # auto | always | never
COMPOSE_VERSION="${COMPOSE_VERSION:-v2.30.3}"

remote() {
  ssh "$SSH_TARGET" "$@"
}

remote_bash() {
  ssh "$SSH_TARGET" bash -s -- "$@"
}

ensure_remote_project() {
  remote_bash "$REMOTE_ROOT" "$REMOTE_PROJECT_DIR" "$REPO_URL" <<'REMOTE'
set -euo pipefail
remote_root="$1"
project_dir="$2"
repo_url="$3"
mkdir -p "$remote_root/projects" "$remote_root/agents" "$remote_root/shared" "$remote_root/.state"
if [ -d "$project_dir/.git" ]; then
  git -C "$project_dir" pull --ff-only
else
  rm -rf "$project_dir"
  git clone "$repo_url" "$project_dir"
fi
REMOTE
}

ensure_remote_image() {
  local should_load=0
  case "$SYNC_IMAGE" in
    always) should_load=1 ;;
    never) should_load=0 ;;
    auto)
      if ! remote "docker image inspect '$IMAGE' >/dev/null 2>&1"; then
        should_load=1
      fi
      ;;
    *)
      echo "Invalid SYNC_IMAGE=$SYNC_IMAGE. Use auto, always, or never." >&2
      exit 2
      ;;
  esac

  if [ "$should_load" -eq 1 ]; then
    docker image inspect "$IMAGE" >/dev/null
    echo "Loading $IMAGE onto $SSH_TARGET..."
    docker save "$IMAGE" | gzip | ssh "$SSH_TARGET" 'gunzip | docker load'
  fi
}

ensure_remote_compose() {
  remote_bash "$COMPOSE_VERSION" <<'REMOTE'
set -euo pipefail
compose_version="$1"
if docker compose version >/dev/null 2>&1; then
  docker compose version
  exit 0
fi
arch="$(uname -m)"
case "$arch" in
  x86_64|amd64) arch="x86_64" ;;
  aarch64|arm64) arch="aarch64" ;;
  *) echo "Unsupported architecture for Docker Compose bootstrap: $arch" >&2; exit 2 ;;
esac
mkdir -p "$HOME/.docker/cli-plugins"
url="https://github.com/docker/compose/releases/download/${compose_version}/docker-compose-linux-${arch}"
echo "Installing Docker Compose ${compose_version} from $url"
curl -fsSL "$url" -o "$HOME/.docker/cli-plugins/docker-compose"
chmod +x "$HOME/.docker/cli-plugins/docker-compose"
docker compose version
REMOTE
}

write_remote_compose() {
  remote_bash "$REMOTE_ROOT" "$REMOTE_PROJECT_DIR" "$IMAGE" "$WEB_PORT" "$LITELLM_PORT" <<'REMOTE'
set -euo pipefail
remote_root="$1"
project_dir="$2"
image="$3"
web_port="$4"
litellm_port="$5"
state="$remote_root/.state"
mkdir -p "$state/.ssh" "$remote_root/agents" "$remote_root/shared" "$remote_root/projects"
if [ -d "$HOME/.ssh" ]; then
  find "$HOME/.ssh" -maxdepth 1 -type f \( -name "id_*" -o -name "known_hosts*" \) -exec cp {} "$state/.ssh/" \; 2>/dev/null || true
fi
cat > "$state/.ssh/config" <<'SSHCONFIG'
Host devbox
  HostName host.docker.internal
  User hayua
  StrictHostKeyChecking accept-new

Host *
  StrictHostKeyChecking accept-new
SSHCONFIG
chmod 700 "$state/.ssh"
chmod 600 "$state/.ssh"/* 2>/dev/null || true

cat > "$remote_root/compose.yml" <<COMPOSE
name: aks-rp-e2e

services:
  litellm:
    image: ghcr.io/berriai/litellm:main-latest
    restart: unless-stopped
    entrypoint: ["/bin/sh"]
    command:
      - -c
      - python3 /app/patch-litellm.py && exec litellm --config /app/config.yaml --port 4000
    ports:
      - "${litellm_port}:4000"
    environment:
      HOME: /home/litellm
      LITELLM_CONFIG_FILE_PATH: /app/config.yaml
    volumes:
      - /home/hayua/litellm/config.yaml:/app/config.yaml:ro
      - /home/hayua/litellm/patch-litellm.py:/app/patch-litellm.py:ro
      - /home/hayua/litellm/github_copilot:/home/litellm/.config/litellm/github_copilot

  may:
    image: ${image}
    container_name: aks-rp-e2e-agent
    hostname: aks-rp-e2e-agent
    restart: unless-stopped
    depends_on:
      - litellm
    extra_hosts:
      - "host.docker.internal:host-gateway"
    ports:
      - "${web_port}:8080"
    volumes:
      - ${state}:/app/.state
      - ${remote_root}/agents:/app/agents
      - ${remote_root}/shared:/app/shared
      - ${remote_root}/projects:/app/projects
      - /home/hayua/rp:/home/hayua/rp
    environment:
      INSTANCE: aks-rp-e2e
      DAEMON_INSTANCE: aks-rp-e2e
      DAEMON_AGENT: aks-explorer
      AGENT: aks-explorer
      MAY_ARGS: "--chat --cron --console --socket"
      MODEL_BASE_URL: http://litellm:4000
      LITELLM_API_KEY: not-needed
      CONTEXT_LEARN_AGENTS: aks-explorer
COMPOSE
REMOTE
}

start_stack() {
  remote_bash "$REMOTE_ROOT" "$COMPOSE_PROJECT" <<'REMOTE'
set -euo pipefail
remote_root="$1"
compose_project="$2"
cd "$remote_root"
docker compose -p "$compose_project" -f compose.yml up -d
docker compose -p "$compose_project" -f compose.yml ps
REMOTE
}

ensure_remote_project
ensure_remote_image
ensure_remote_compose
write_remote_compose
start_stack

echo
echo "Web UI:  http://$SSH_TARGET:$WEB_PORT/projects/aks-rp-e2e/ui/"
echo "LiteLLM: http://$SSH_TARGET:$LITELLM_PORT"
echo "Logs:    ssh $SSH_TARGET 'cd $REMOTE_ROOT && docker compose -p $COMPOSE_PROJECT -f compose.yml logs -f'"
