#!/bin/bash
# run-e2e.sh — Pre-flight check + e2e test runner for AKS RP standalone
# Usage: ./run-e2e.sh [scenario-name] [--skip-checks]
#
# Examples:
#   ./run-e2e.sh                          # Run pre-flight checks only
#   ./run-e2e.sh CreateCluster            # Run specific scenario
#   ./run-e2e.sh CreateCluster --skip-checks  # Skip pre-flight, run directly

set -euo pipefail

RP_ROOT="${RP_ROOT:-/home/hayua/rp}"
SUITE="${E2E_SUITE:-dev}"
SCENARIO="${1:-}"
SKIP_CHECKS="${2:-}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
pass() { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }

# ── Pre-flight checks ──────────────────────────────────────────────
preflight() {
    local errors=0
    echo "=== Pre-flight checks ==="

    # 1. RP repo exists
    if [[ -d "$RP_ROOT/test/e2ev3" ]]; then
        pass "RP repo found at $RP_ROOT"
    else
        fail "RP repo not found at $RP_ROOT"; ((errors++))
    fi

    # 2. Go installed
    if command -v go &>/dev/null; then
        pass "Go $(go version | awk '{print $3}')"
    else
        fail "Go not installed"; ((errors++))
    fi

    # 3. aksbuilder / Bazel
    if [[ -x "$RP_ROOT/hack/aksbuilder.sh" ]]; then
        pass "aksbuilder.sh found"
    else
        fail "aksbuilder.sh not found"; ((errors++))
    fi

    # 4. e2ev3 entry script
    if [[ -x "$RP_ROOT/test/e2ev3/hack/e2ev3" ]] || [[ -f "$RP_ROOT/test/e2ev3/hack/e2ev3" ]]; then
        pass "e2ev3 entry script found"
    else
        fail "e2ev3 entry script not found"; ((errors++))
    fi

    # 5. Key Vault DNS (standalone infra health proxy)
    local kv_host
    kv_host=$(grep -r 'keyvault' "$RP_ROOT/test/e2ev3/" --include='*.go' -l 2>/dev/null | head -1 || true)
    # Try resolving the standalone KV — pattern: <env>-akssvc.vault.azure.net
    if host aks-rp-standalone-akssvc.vault.azure.net &>/dev/null 2>&1; then
        pass "Key Vault DNS resolves (standalone infra likely up)"
    elif nslookup aks-rp-standalone-akssvc.vault.azure.net &>/dev/null 2>&1; then
        pass "Key Vault DNS resolves (standalone infra likely up)"
    else
        fail "Key Vault DNS NXDOMAIN — standalone not deployed"
        echo "  → Deploy with: cd $RP_ROOT && hack/aksbuilder_localdeploy.sh"
        echo "  → Or check running deploy: ps aux | grep aksbuilder"
        ((errors++))
    fi

    # 6. Azure auth
    if az account show &>/dev/null 2>&1; then
        pass "Azure CLI authenticated"
    else
        warn "Azure CLI not authenticated (may use MSI instead)"
    fi

    # 7. BUILD_VERSION
    if [[ -n "${BUILD_VERSION:-}" ]]; then
        pass "BUILD_VERSION=$BUILD_VERSION"
    else
        local latest
        latest=$(ls -t "$RP_ROOT/out/build_version" 2>/dev/null | head -1 || true)
        if [[ -n "$latest" ]]; then
            warn "BUILD_VERSION not set, but found: $latest"
        else
            warn "BUILD_VERSION not set — will need one for test run"
        fi
    fi

    # 8. Check for running deploy
    if pgrep -f 'aksbuilder_localdeploy\|aksbuilder.*deploy' &>/dev/null; then
        warn "Deploy process running — wait for completion before testing"
    fi

    echo ""
    if [[ $errors -gt 0 ]]; then
        fail "$errors pre-flight check(s) failed — fix before running tests"
        return 1
    else
        pass "All pre-flight checks passed"
        return 0
    fi
}

# ── Run e2e test ────────────────────────────────────────────────────
run_test() {
    local scenario="$1"
    echo ""
    echo "=== Running e2e test ==="
    echo "Suite:    $SUITE"
    echo "Scenario: $scenario"
    echo ""

    local cmd="$RP_ROOT/test/e2ev3/hack/e2ev3 $SUITE --scenario $scenario --debug"
    if [[ -n "${BUILD_VERSION:-}" ]]; then
        cmd="$cmd --build-version $BUILD_VERSION"
    fi

    echo "Command: $cmd"
    echo "─────────────────────────────────────────"
    exec $cmd
}

# ── Main ────────────────────────────────────────────────────────────
if [[ "$SKIP_CHECKS" != "--skip-checks" ]]; then
    if ! preflight; then
        exit 1
    fi
fi

if [[ -z "$SCENARIO" ]]; then
    echo ""
    echo "No scenario specified. To run a test:"
    echo "  $0 <scenario-name>"
    echo ""
    echo "Find scenarios with:"
    echo "  grep -r 'Name:' $RP_ROOT/test/e2ev3/sigs/*/scenarios/*.go | head -20"
    exit 0
fi

run_test "$SCENARIO"
