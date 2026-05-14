#!/usr/bin/env bash
# fix-msi-identity.sh
# Fixes the missing akse2ehcp-e2e MSI (Managed Service Identity) on the devbox VM.
# This was the root cause of e2e failures — the standalone RP needs this identity
# to provision overlay resources.
#
# Usage:
#   ./fix-msi-identity.sh
#
# What it does:
#   Patches the devbox VM to add the akse2ehcp-e2e user-assigned managed identity.
#   This identity is required by the standalone RP for HCP operations.
#
# Prerequisites:
#   - az CLI logged in with sufficient permissions
#   - Access to the RP subscription (18153b17-4e27-4b58-863e-f8105b8892a2)

set -euo pipefail

# Configuration — adjust these for your environment
SUBSCRIPTION="${MSI_SUBSCRIPTION:-18153b17-4e27-4b58-863e-f8105b8892a2}"
RESOURCE_GROUP="${VM_RESOURCE_GROUP:-}"  # Set to your devbox VM's resource group
VM_NAME="${VM_NAME:-}"                   # Set to your devbox VM name
MSI_NAME="akse2ehcp-e2e"

if [[ -z "$RESOURCE_GROUP" || -z "$VM_NAME" ]]; then
  echo "ERROR: Set VM_RESOURCE_GROUP and VM_NAME environment variables."
  echo ""
  echo "Example:"
  echo "  export VM_RESOURCE_GROUP=mygroup"
  echo "  export VM_NAME=mydevbox"
  echo "  ./fix-msi-identity.sh"
  echo ""
  echo "To find your VM details:"
  echo "  az vm list --subscription $SUBSCRIPTION -o table"
  exit 1
fi

MSI_RESOURCE_ID="/subscriptions/${SUBSCRIPTION}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.ManagedIdentity/userAssignedIdentities/${MSI_NAME}"
VM_RESOURCE_ID="/subscriptions/${SUBSCRIPTION}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.Compute/virtualMachines/${VM_NAME}"

echo "=== Fixing MSI Identity ==="
echo "VM:  $VM_RESOURCE_ID"
echo "MSI: $MSI_RESOURCE_ID"
echo ""

# Check if MSI already assigned
echo "Checking current identities..."
CURRENT=$(az vm identity show --ids "$VM_RESOURCE_ID" -o json 2>/dev/null || echo "{}")
if echo "$CURRENT" | grep -q "$MSI_NAME"; then
  echo "✓ MSI '$MSI_NAME' is already assigned to the VM."
  exit 0
fi

echo "Adding MSI '$MSI_NAME' to VM..."
az rest --method patch \
  --url "https://management.azure.com${VM_RESOURCE_ID}?api-version=2023-07-01" \
  --body "{\"identity\":{\"type\":\"UserAssigned\",\"userAssignedIdentities\":{\"${MSI_RESOURCE_ID}\":{}}}}"

echo ""
echo "✓ MSI '$MSI_NAME' added successfully."
echo "  The standalone RP should now be able to provision HCPs."
