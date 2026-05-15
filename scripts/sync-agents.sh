#!/usr/bin/env bash
#
# sync-agents.sh — Two-way sync app/ between local and k3s pod.
#
# Flow:
#   1. Local: commit any dirty files
#   2. Local: push to bare repo
#   3. Pod: pull from bare (merge)
#   4. Pod: push merged result to bare + dell-laptop
#   5. Local: pull merged result from bare
#
# Both sides end on the same commit. Dell-laptop gets backup.

set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/../app" && pwd)"
KUBECONFIG="${KUBECONFIG:-$HOME/infra/k3s/kubeconfig.yaml}"
NAMESPACE="may-agent"
POD="may-agent-0"
CONTAINER="may-agent"

export KUBECONFIG
kexec() { kubectl exec -n "$NAMESPACE" "$POD" -c "$CONTAINER" -- sh -c "$1" 2>&1; }

echo "=== 1. Commit local ==="
cd "$APP_DIR"
git add -A
git diff --cached --quiet && echo "(clean)" || git commit -m "chore: local sync"

echo ""
echo "=== 2. Push local → bare ==="
git push k3s main

echo ""
echo "=== 3. Pod: commit + pull from bare ==="
kexec '
cd /app
git add -A
git diff --cached --quiet || git commit -m "chore(auto): pod sync"
git fetch local-bare main
git merge --no-edit local-bare/main || git reset --hard local-bare/main
'

echo ""
echo "=== 4. Pod: push → bare + dell-laptop ==="
kexec '
cd /app
git push local-bare main
git push origin main || echo "(origin push failed — non-fatal)"
'

echo ""
echo "=== 5. Pull merged → local ==="
git pull --no-rebase k3s main

echo ""
LOCAL=$(git rev-parse --short HEAD)
POD_SHA=$(kexec 'cd /app && git rev-parse --short HEAD')
echo "=== Done: local=$LOCAL pod=$POD_SHA ==="
