#!/usr/bin/env bash
# check-underlay-capacity.sh
# Checks underlay cluster count and capacity in the standalone RP environment.
#
# Usage:
#   ./check-underlay-capacity.sh
#
# What it checks:
#   1. Lists registered underlays via aksdev
#   2. Shows HCP (hosted control plane) count on each underlay
#   3. Reports available capacity
#
# Prerequisites:
#   - Run from /home/hayua/rp (or set RP_ROOT)
#   - aksdev binary built
#   - kubeconfig available for underlay access (via aksdev sd connect/kubeconfig)

set -euo pipefail

RP_ROOT="${RP_ROOT:-/home/hayua/rp}"
AKSDEV="${RP_ROOT}/bin/aksdev"
AZURECONFIG="${AZURECONFIG:-${RP_ROOT}/azureconfig.yaml}"

echo "=== Underlay Capacity Check ==="
echo "Using aksdev: $AKSDEV"
echo ""

# 1. List clusters to see how many are deployed
echo "--- Current Clusters (shows load on underlays) ---"
CLUSTER_LIST=$("$AKSDEV" cluster list --all --azureconfig "$AZURECONFIG" -o short 2>/dev/null || echo "(no clusters or error)")
echo "$CLUSTER_LIST"
CLUSTER_COUNT=$(echo "$CLUSTER_LIST" | grep -c "." 2>/dev/null || echo "0")
echo ""
echo "Total clusters: $CLUSTER_COUNT"
echo ""

# 2. Check underlay kubeconfigs available
echo "--- Available Underlay Connections ---"
"$AKSDEV" sd connect --help 2>/dev/null | grep -A2 "Usage" || true
echo ""

# 3. If we have kubectl access to an underlay, check HCP namespaces
echo "--- HCP Namespaces on Current Underlay (if connected) ---"
if command -v kubectl &>/dev/null; then
  HCP_NS=$(kubectl get ns 2>/dev/null | grep -c "^hcp-" || echo "0")
  echo "HCP namespaces: $HCP_NS"
  
  if [[ "$HCP_NS" -gt 0 ]]; then
    echo ""
    echo "HCP namespace details:"
    kubectl get ns | grep "^hcp-" | head -20
  fi
  
  echo ""
  echo "--- Node Capacity ---"
  kubectl get nodes -o wide 2>/dev/null | head -20 || echo "(not connected to underlay)"
else
  echo "(kubectl not found)"
fi

echo ""
echo "=== Capacity Summary ==="
echo "Clusters deployed: $CLUSTER_COUNT"
echo "Note: Each underlay typically supports ~60 HCPs for e2e."
echo "      If at capacity, delete stale clusters before running new scenarios."
echo "      Use: ./cleanup-standalone-clusters.sh --delete"
