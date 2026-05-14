#!/usr/bin/env bash
# run-e2e-scenario.sh
# Wrapper to run a single e2ev3 scenario against the standalone RP environment.
#
# Usage:
#   ./run-e2e-scenario.sh <ScenarioName> [extra-flags...]
#
# Examples:
#   ./run-e2e-scenario.sh Nginx_Disablement
#   ./run-e2e-scenario.sh DefaultDomain_HelloWorld --debug
#   ./run-e2e-scenario.sh ManagedSystemPool_Enable
#
# Prerequisites:
#   - Run from /home/hayua/rp (or set RP_ROOT)
#   - Build version set (or detected from existing build)
#   - aksdev binary built
#
# Known working scenarios (as of build hayuaebld163822451):
#   - Nginx_Disablement
#   - DefaultDomain_HelloWorld
#   - ManagedSystemPool_Enable

set -euo pipefail

RP_ROOT="${RP_ROOT:-/home/hayua/rp}"
AKSDEV="${RP_ROOT}/bin/aksdev"
AZURECONFIG="${AZURECONFIG:-${RP_ROOT}/azureconfig.yaml}"
TIMEOUT="${E2E_TIMEOUT:-60m}"
BUILD_VERSION="${BUILD_VERSION:-}"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <ScenarioName> [extra-flags...]"
  echo ""
  echo "Known scenarios: Nginx_Disablement, DefaultDomain_HelloWorld, ManagedSystemPool_Enable"
  exit 1
fi

SCENARIO="$1"
shift

# Auto-detect build version from aksdev if not set
if [[ -z "$BUILD_VERSION" ]]; then
  # Try to read from the standard location
  if [[ -f "${RP_ROOT}/.build_version" ]]; then
    BUILD_VERSION=$(cat "${RP_ROOT}/.build_version")
  else
    echo "WARNING: BUILD_VERSION not set and .build_version not found."
    echo "Set BUILD_VERSION env var or create ${RP_ROOT}/.build_version"
    echo "Example: export BUILD_VERSION=hayuaebld163822451"
    exit 1
  fi
fi

echo "=== Running e2ev3 Scenario ==="
echo "Scenario:      $SCENARIO"
echo "Build Version: $BUILD_VERSION"
echo "Timeout:       $TIMEOUT"
echo "Config:        $AZURECONFIG"
echo "Extra flags:   $*"
echo ""

cd "$RP_ROOT"

# Use the hack/e2ev3 wrapper with 'dev' mode for standalone
exec ./test/e2ev3/hack/e2ev3 dev \
  --build-version="$BUILD_VERSION" \
  -s "$SCENARIO" \
  --test-region eastus2 \
  --azureconfig "$AZURECONFIG" \
  "$@"
