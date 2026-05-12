#!/bin/bash
# Run this ON DEVBOX to execute the first e2e test
# Build version: hayuaebld163822451
set -euo pipefail

cd /home/hayua/rp

echo "=== Step 1: Verify standalone pods ==="
kubectl get pods -n aks-rp 2>&1 | head -30

echo ""
echo "=== Step 2: Run Scenario_Preflight ==="
test/e2ev3/hack/e2ev3 dev \
  --scenario Scenario_Preflight \
  --debug \
  --build-version hayuaebld163822451 \
  2>&1 | tee /tmp/e2e-first-run.log | head -200

echo ""
echo "=== Exit code: $? ==="
echo "Full log at /tmp/e2e-first-run.log"
