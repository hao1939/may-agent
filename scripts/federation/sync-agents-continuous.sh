#!/usr/bin/env bash
#
# sync-agents-continuous.sh — Continuous bidirectional sync for agents/ repo
#
# Designed to run as a systemd timer on the k3s host (every 5 min).
# Bridges: local push → bare repo → pod pull, and pod push → bare repo → local pull.
#
# This replaces the old /opt/sync-agents.sh with proper error handling and logging.

set -euo pipefail

BARE_REPO="/opt/may-agents.git"
# k3s PVC path — update if PVC changes
POD_SYNC_REPO="/var/lib/rancher/k3s/storage/pvc-7f333b88-f968-427a-80d4-7d4400062219_may-agent_data-may-agent-0/app/.state/agents-sync.git"
LOG="/var/log/may-agent-sync.log"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" >> "$LOG"; }

# Bail if pod sync repo doesn't exist (pod not running)
if [ ! -d "$POD_SYNC_REPO" ]; then
  log "SKIP: pod sync repo not found at $POD_SYNC_REPO"
  exit 0
fi

cd "$BARE_REPO"

# 1. Pod → Host: fetch pod's commits into bare repo
if git fetch "$POD_SYNC_REPO" main:main 2>/dev/null; then
  log "OK: pod → host"
else
  log "WARN: pod → host fetch failed"
fi

# 2. Host → Pod: push host main into pod's sync bare repo
if git push "$POD_SYNC_REPO" main:main 2>/dev/null; then
  log "OK: host → pod"
else
  log "WARN: host → pod push failed"
fi
