#!/usr/bin/env bash
# standalone-readiness-check.sh — Verify standalone environment is ready for e2e tests
# Usage: ssh devbox 'bash -s' < standalone-readiness-check.sh
#    or: ./standalone-readiness-check.sh  (if run directly on devbox)
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
PASS=0; FAIL=0; WARN=0

check() {
  local label="$1"; shift
  if eval "$@" >/dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} $label"; PASS=$((PASS+1))
  else
    echo -e "  ${RED}✗${NC} $label"; FAIL=$((FAIL+1))
  fi
}

warn_check() {
  local label="$1"; shift
  if eval "$@" >/dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} $label"; PASS=$((PASS+1))
  else
    echo -e "  ${YELLOW}⚠${NC} $label (optional)"; WARN=$((WARN+1))
  fi
}

echo "=== Standalone Environment Readiness ==="
echo

# 1. Repo exists
echo "Repo:"
RP_DIR="${RP_DIR:-/home/hayua/rp}"
check "Repo directory exists" "[ -d '$RP_DIR' ]"
check "test/e2ev3 exists" "[ -d '$RP_DIR/test/e2ev3' ]"
check "hack/e2ev3 entry script" "[ -x '$RP_DIR/test/e2ev3/hack/e2ev3' ]"
check "hack/aksbuilder.sh exists" "[ -f '$RP_DIR/hack/aksbuilder.sh' ]"

# 2. Azure auth
echo -e "\nAzure Auth:"
check "az CLI installed" "command -v az"
check "az account show (logged in)" "az account show"
warn_check "azureconfig.yaml exists" "[ -f ~/azureconfig.yaml ]"

# 3. Key Vault DNS (proxy for standalone being deployed)
echo -e "\nStandalone Environment:"
KV_NAME="${KV_NAME:-aks-rp-hayua-kv}"
if nslookup "${KV_NAME}.vault.azure.net" >/dev/null 2>&1; then
  echo -e "  ${GREEN}✓${NC} Key Vault DNS resolves (${KV_NAME})"
  PASS=$((PASS+1))
  # Try to access it
  if az keyvault secret list --vault-name "$KV_NAME" --maxresults 1 >/dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} Key Vault accessible"; PASS=$((PASS+1))
  else
    echo -e "  ${YELLOW}⚠${NC} Key Vault DNS resolves but secrets inaccessible (check RBAC)"; WARN=$((WARN+1))
  fi
else
  echo -e "  ${RED}✗${NC} Key Vault DNS NXDOMAIN — standalone not deployed"
  echo -e "       Deploy with: ${RP_DIR}/hack/aksbuilder_localdeploy.sh ${RP_DIR}"
  FAIL=$((FAIL+1))
fi

# 4. Build tools
echo -e "\nBuild Tools:"
check "Go installed" "command -v go"
check "bazel or bazelisk" "command -v bazel || command -v bazelisk"
warn_check "Docker/podman available" "command -v docker || command -v podman"

# 5. Build version detection
echo -e "\nBuild Version:"
# Look for recent build artifacts or env var
if [ -n "${BUILD_VERSION:-}" ]; then
  echo -e "  ${GREEN}✓${NC} BUILD_VERSION set: $BUILD_VERSION"
  PASS=$((PASS+1))
else
  echo -e "  ${YELLOW}⚠${NC} BUILD_VERSION not set — you'll need one from a localdeploy run"
  WARN=$((WARN+1))
fi

# Summary
echo
echo "=== Summary ==="
echo -e "  ${GREEN}Pass: $PASS${NC}  ${RED}Fail: $FAIL${NC}  ${YELLOW}Warn: $WARN${NC}"
if [ $FAIL -eq 0 ]; then
  echo -e "\n${GREEN}Ready to run e2e tests!${NC}"
  echo "  Example: cd $RP_DIR/test/e2ev3 && ./hack/e2ev3 dev --build-version=\$BUILD_VERSION -s <scenario> --test-region eastus2"
else
  echo -e "\n${RED}Not ready — fix the failures above.${NC}"
  exit 1
fi
