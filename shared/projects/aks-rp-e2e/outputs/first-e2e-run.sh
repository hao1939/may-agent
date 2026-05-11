#!/usr/bin/env bash
# first-e2e-run.sh — Automated first e2e test run for AKS RP standalone
# Usage: ./first-e2e-run.sh [scenario-name]
# Default scenario: CreateCluster (from sig-cluster-lifecycle)
set -euo pipefail

SCENARIO="${1:-CreateCluster}"
RP_ROOT="${RP_ROOT:-$HOME/rp}"
E2E_HACK="$RP_ROOT/test/e2ev3/hack"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
pass() { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; FAILURES+=("$1"); }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }

FAILURES=()

echo "=== AKS RP E2E Readiness & Run ==="
echo "Repo:     $RP_ROOT"
echo "Scenario: $SCENARIO"
echo ""

# --- Phase 1: Prerequisites ---
echo "--- Phase 1: Prerequisites ---"

# Go
if command -v go &>/dev/null; then
  pass "Go $(go version | awk '{print $3}')"
else
  fail "Go not installed"
fi

# Entry script
if [[ -x "$E2E_HACK/e2ev3" ]]; then
  pass "e2ev3 entry script found"
else
  fail "e2ev3 entry script not found at $E2E_HACK/e2ev3"
fi

# BUILD_VERSION
if [[ -n "${BUILD_VERSION:-}" ]]; then
  pass "BUILD_VERSION=$BUILD_VERSION"
else
  # Try to detect from aksbuilder
  BV=$(cd "$RP_ROOT" && git describe --tags --abbrev=8 2>/dev/null || echo "")
  if [[ -n "$BV" ]]; then
    export BUILD_VERSION="$BV"
    warn "BUILD_VERSION auto-detected: $BV (set explicitly for reproducibility)"
  else
    fail "BUILD_VERSION not set and cannot auto-detect"
  fi
fi

# --- Phase 2: Standalone Infrastructure ---
echo ""
echo "--- Phase 2: Standalone Infrastructure ---"

# Check Key Vault DNS (pattern: *-kv.vault.azure.net)
KV_CANDIDATES=$(grep -rh 'vault.azure.net' "$RP_ROOT/test/e2ev3/" --include='*.go' 2>/dev/null | grep -oP '[a-zA-Z0-9_-]+\.vault\.azure\.net' | sort -u | head -3)
KV_OK=false
for kv in $KV_CANDIDATES; do
  if nslookup "$kv" &>/dev/null; then
    pass "Key Vault DNS resolves: $kv"
    KV_OK=true
    break
  fi
done
if ! $KV_OK; then
  # Fallback: check if localdev config references a KV
  fail "Key Vault DNS not resolving — standalone likely not deployed"
  echo "  Fix: run 'hack/aksbuilder_localdeploy.sh' to deploy standalone environment"
fi

# Azure auth
if az account show &>/dev/null 2>&1; then
  ACCT=$(az account show --query '{sub:id,user:user.name}' -o tsv 2>/dev/null)
  pass "Azure CLI authenticated ($ACCT)"
else
  fail "Azure CLI not authenticated — run 'az login'"
fi

# --- Phase 3: Scenario Validation ---
echo ""
echo "--- Phase 3: Scenario Validation ---"

# Check scenario exists in codebase
SCENARIO_FILES=$(grep -rl "\"$SCENARIO\"" "$RP_ROOT/test/e2ev3/sigs/" --include='*.go' 2>/dev/null || true)
if [[ -n "$SCENARIO_FILES" ]]; then
  pass "Scenario '$SCENARIO' found in: $(echo $SCENARIO_FILES | head -1)"
else
  warn "Scenario '$SCENARIO' not found via grep — may use different registration pattern"
fi

# --- Decision ---
echo ""
if [[ ${#FAILURES[@]} -gt 0 ]]; then
  echo -e "${RED}=== BLOCKED: ${#FAILURES[@]} failure(s) ===${NC}"
  for f in "${FAILURES[@]}"; do echo "  - $f"; done
  echo ""
  echo "Fix the above issues, then re-run this script."
  exit 1
fi

# --- Phase 4: Execute ---
echo -e "${GREEN}=== All checks passed — launching e2e test ===${NC}"
echo ""
echo "Command: $E2E_HACK/e2ev3 dev --build-version $BUILD_VERSION --scenario $SCENARIO --debug"
echo ""
read -p "Proceed? [y/N] " confirm
if [[ "$confirm" =~ ^[Yy]$ ]]; then
  cd "$RP_ROOT"
  exec "$E2E_HACK/e2ev3" dev \
    --build-version "$BUILD_VERSION" \
    --scenario "$SCENARIO" \
    --debug
else
  echo "Aborted. Run manually:"
  echo "  cd $RP_ROOT && $E2E_HACK/e2ev3 dev --build-version $BUILD_VERSION --scenario $SCENARIO --debug"
fi
