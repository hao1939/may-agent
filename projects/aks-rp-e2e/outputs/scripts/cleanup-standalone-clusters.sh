#!/usr/bin/env bash
# cleanup-standalone-clusters.sh
# Lists and optionally deletes all AKS clusters in the standalone RP environment.
#
# Usage:
#   ./cleanup-standalone-clusters.sh              # List all clusters (dry-run)
#   ./cleanup-standalone-clusters.sh --delete     # Delete all clusters
#   ./cleanup-standalone-clusters.sh --delete --rg <resourcegroup>  # Delete specific RG
#
# Prerequisites:
#   - Run from /home/hayua/rp (or set RP_ROOT)
#   - aksdev binary built at $RP_ROOT/bin/aksdev
#   - azureconfig.yaml present at $RP_ROOT/azureconfig.yaml (or pass --azureconfig)

set -euo pipefail

RP_ROOT="${RP_ROOT:-/home/hayua/rp}"
AKSDEV="${RP_ROOT}/bin/aksdev"
AZURECONFIG="${AZURECONFIG:-${RP_ROOT}/azureconfig.yaml}"

DELETE=false
TARGET_RG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --delete) DELETE=true; shift ;;
    --rg) TARGET_RG="$2"; shift 2 ;;
    --azureconfig) AZURECONFIG="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

echo "=== Standalone Cluster List ==="
echo "Using aksdev: $AKSDEV"
echo "Using config: $AZURECONFIG"
echo ""

# List all clusters
CLUSTER_LIST=$("$AKSDEV" cluster list --all --azureconfig "$AZURECONFIG" -o json 2>/dev/null || echo "[]")
echo "$CLUSTER_LIST" | python3 -m json.tool 2>/dev/null || echo "$CLUSTER_LIST"

if [[ "$DELETE" == "true" ]]; then
  echo ""
  if [[ -n "$TARGET_RG" ]]; then
    echo "=== Deleting clusters in resource group: $TARGET_RG ==="
    "$AKSDEV" cluster delete --resourcegroup "$TARGET_RG" --azureconfig "$AZURECONFIG" --wait
    echo "Done: deleted cluster in $TARGET_RG"
  else
    echo "=== Batch deleting ALL clusters ==="
    "$AKSDEV" cluster delete-batch --azureconfig "$AZURECONFIG"
    echo "Done: batch delete initiated"
  fi
else
  echo ""
  echo "(Dry-run mode. Pass --delete to actually remove clusters.)"
fi
