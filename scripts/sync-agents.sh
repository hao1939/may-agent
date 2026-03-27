#!/usr/bin/env bash
#
# sync-agents.sh — Sync agents/ repo: local → k3s → origin (dell-laptop)
#
# Flow:
#   1. Push local changes to k3s bare repo (post-receive deploys to PVC)
#   2. k3s pod pulls from PVC, rebases if needed
#   3. k3s pod pushes to origin (dell-laptop)
#
# Usage: scripts/sync-agents.sh

set -euo pipefail

AGENTS_DIR="$(cd "$(dirname "$0")/../agents" && pwd)"
KUBECONFIG="${KUBECONFIG:-$HOME/infra/k3s/kubeconfig.yaml}"
NAMESPACE="may-agent"
POD="may-agent-0"
CONTAINER="may-agent"

export KUBECONFIG

echo "=== Step 1: Push local → k3s ==="
cd "$AGENTS_DIR"
git push k3s main 2>&1 || {
  echo "Push to k3s failed. Trying pull --rebase first..."
  git pull --rebase k3s main 2>&1
  git push k3s main 2>&1
}

echo ""
echo "=== Step 2: k3s pod push → origin ==="
kubectl exec -n "$NAMESPACE" "$POD" -c "$CONTAINER" -- sh -c '
  cd /app/agents
  git push origin main 2>&1
' 2>&1 || {
  echo "Push to origin failed. Trying pull --rebase first..."
  kubectl exec -n "$NAMESPACE" "$POD" -c "$CONTAINER" -- sh -c '
    cd /app/agents
    git pull --rebase origin main 2>&1
    git push origin main 2>&1
  ' 2>&1
}

echo ""
echo "=== Done ==="
echo "Local → k3s → origin synced."
