#!/usr/bin/env bash
# Pre-push check — run test suite before allowing push
# Install: ln -sf ../../agents/shared/scripts/pre-push-check.sh .git/hooks/pre-push

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔍 Running pre-push test check..."

if "$SCRIPT_DIR/test-guard.sh"; then
    echo ""
    echo "✅ All clear — push proceeding."
    exit 0
else
    echo ""
    echo "❌ BLOCKED: tests failing, push aborted."
    echo "   Fix failing tests before pushing."
    exit 1
fi
