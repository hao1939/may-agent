#!/bin/bash
# Post-deploy validation and first e2e test runner
# Run on devbox after aksbuilder_localdeploy.sh completes
# Usage: bash post-deploy-validation.sh [scenario-name]
set -euo pipefail

SCENARIO="${1:-CreateManagedClusterWithDefaults}"
E2E_SCRIPT="test/e2ev3/hack/e2ev3"
RP_DIR="${RP_DIR:-/home/hayua/rp}"
RESULTS_FILE="$HOME/e2e-validation-$(date +%Y%m%d-%H%M%S).log"

cd "$RP_DIR"

echo "=== Post-Deploy Validation ===" | tee "$RESULTS_FILE"
echo "Time: $(date -u)" | tee -a "$RESULTS_FILE"

# Step 1: Check deploy process
echo -e "\n--- Step 1: Deploy process check ---" | tee -a "$RESULTS_FILE"
if pgrep -f aksbuilder_localdeploy > /dev/null 2>&1; then
    echo "⚠️  localdeploy still running! Wait for it to finish." | tee -a "$RESULTS_FILE"
    echo "   Monitor: tail -f ~/localdeploy.log" | tee -a "$RESULTS_FILE"
    exit 1
fi
echo "✅ No localdeploy process running" | tee -a "$RESULTS_FILE"

# Step 2: Check Key Vault DNS
echo -e "\n--- Step 2: Key Vault DNS ---" | tee -a "$RESULTS_FILE"
KV_HOST=$(grep -r 'keyvault\|KeyVault' hack/aksbuilder_localdeploy.sh 2>/dev/null | grep -oP '[\w-]+\.vault\.azure\.net' | head -1 || true)
if [ -z "$KV_HOST" ]; then
    # Try finding KV from env files
    KV_HOST=$(find . -path '*/standalone*' -name '*.env' -exec grep -l vault {} \; 2>/dev/null | head -1 | xargs grep -oP '[\w-]+\.vault\.azure\.net' 2>/dev/null | head -1 || true)
fi
if [ -n "$KV_HOST" ]; then
    if nslookup "$KV_HOST" > /dev/null 2>&1; then
        echo "✅ Key Vault DNS resolves: $KV_HOST" | tee -a "$RESULTS_FILE"
    else
        echo "❌ Key Vault DNS NXDOMAIN: $KV_HOST" | tee -a "$RESULTS_FILE"
        echo "   Standalone environment likely not deployed." | tee -a "$RESULTS_FILE"
        exit 1
    fi
else
    echo "⚠️  Could not auto-detect KV hostname. Check manually." | tee -a "$RESULTS_FILE"
fi

# Step 3: Check tools
echo -e "\n--- Step 3: Toolchain ---" | tee -a "$RESULTS_FILE"
for cmd in go az kubectl; do
    if command -v $cmd &>/dev/null; then
        echo "✅ $cmd: $(command -v $cmd)" | tee -a "$RESULTS_FILE"
    else
        echo "❌ $cmd not found" | tee -a "$RESULTS_FILE"
    fi
done

# Step 4: Check BUILD_VERSION
echo -e "\n--- Step 4: Build version ---" | tee -a "$RESULTS_FILE"
if [ -n "${BUILD_VERSION:-}" ]; then
    echo "✅ BUILD_VERSION=$BUILD_VERSION" | tee -a "$RESULTS_FILE"
else
    # Try to detect from recent builds
    LATEST=$(find . -name 'BUILD_VERSION' -o -name 'build_version' 2>/dev/null | head -1 | xargs cat 2>/dev/null || true)
    if [ -n "$LATEST" ]; then
        echo "ℹ️  Detected build version: $LATEST" | tee -a "$RESULTS_FILE"
        export BUILD_VERSION="$LATEST"
    else
        echo "⚠️  BUILD_VERSION not set. Will need --build-version flag." | tee -a "$RESULTS_FILE"
    fi
fi

# Step 5: Check e2e script exists
echo -e "\n--- Step 5: E2E script ---" | tee -a "$RESULTS_FILE"
if [ -x "$E2E_SCRIPT" ]; then
    echo "✅ $E2E_SCRIPT exists and is executable" | tee -a "$RESULTS_FILE"
else
    echo "❌ $E2E_SCRIPT not found or not executable" | tee -a "$RESULTS_FILE"
    exit 1
fi

# Step 6: Run the test
echo -e "\n--- Step 6: Running e2e test ---" | tee -a "$RESULTS_FILE"
echo "Suite: dev | Scenario: $SCENARIO" | tee -a "$RESULTS_FILE"
echo "Command: $E2E_SCRIPT dev --scenario $SCENARIO --debug" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

set +e
$E2E_SCRIPT dev --scenario "$SCENARIO" --debug 2>&1 | tee -a "$RESULTS_FILE"
EXIT_CODE=$?
set -e

echo -e "\n--- Result ---" | tee -a "$RESULTS_FILE"
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ E2E test PASSED (exit code 0)" | tee -a "$RESULTS_FILE"
else
    echo "❌ E2E test FAILED (exit code $EXIT_CODE)" | tee -a "$RESULTS_FILE"
    echo "   Check log: $RESULTS_FILE" | tee -a "$RESULTS_FILE"
fi

echo -e "\nFull log saved to: $RESULTS_FILE"
exit $EXIT_CODE
