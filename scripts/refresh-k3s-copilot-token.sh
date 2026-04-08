#!/usr/bin/env bash
#
# refresh-k3s-copilot-token.sh — Copy local copilot token to k3s and restart litellm
#
# Run this when k3s litellm stops working (~every 30 days).
# Copies the local ghu_ access token to the k3s secret and restarts litellm.
#
# Usage: ./scripts/refresh-k3s-copilot-token.sh

set -euo pipefail

KUBECONFIG="${KUBECONFIG:-$HOME/infra/k3s/kubeconfig.yaml}"
NAMESPACE="may-agent"
LOCAL_TOKEN_FILE="$(cd "$(dirname "$0")/.." && pwd)/litellm/github_copilot/access-token"

export KUBECONFIG

if [ ! -f "$LOCAL_TOKEN_FILE" ]; then
  echo "ERROR: Local token not found at $LOCAL_TOKEN_FILE"
  exit 1
fi

TOKEN=$(cat "$LOCAL_TOKEN_FILE")
echo "Local token: ${TOKEN:0:10}..."

# Update the secret
echo "Updating k3s secret..."
kubectl create secret generic may-agent-litellm-copilot-token \
  --from-literal=access-token="$TOKEN" \
  -n "$NAMESPACE" \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart litellm
echo "Restarting litellm..."
kubectl rollout restart deployment may-agent-litellm -n "$NAMESPACE"
kubectl rollout status deployment may-agent-litellm -n "$NAMESPACE" --timeout=120s

# Verify
echo ""
echo "Verifying..."
sleep 5
MODELS=$(kubectl exec -n "$NAMESPACE" deploy/may-agent-litellm -- \
  python3 -c "import urllib.request,json; print(json.loads(urllib.request.urlopen('http://localhost:4000/v1/models').read())['data'][0]['id'])" 2>/dev/null || echo "FAILED")

if [ "$MODELS" = "FAILED" ]; then
  echo "❌ LiteLLM not serving models yet — may need more time to start"
else
  echo "✅ LiteLLM serving model: $MODELS"
fi
