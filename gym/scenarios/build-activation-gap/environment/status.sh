#!/bin/bash
# status.sh — Show what binary the running daemon is using vs. what's deployed
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNTIME_DIR="$SCRIPT_DIR/runtime"
DIST_DIR="$SCRIPT_DIR/dist"

echo "=== Daemon Status ==="

# What binary the daemon loaded at startup
if [ -f "$RUNTIME_DIR/daemon.binary" ]; then
  RUNNING=$(cat "$RUNTIME_DIR/daemon.binary")
  echo "Running binary: $RUNNING"
else
  echo "Running binary: UNKNOWN (no daemon.binary file)"
fi

# What PID
if [ -f "$RUNTIME_DIR/daemon.pid" ]; then
  PID=$(cat "$RUNTIME_DIR/daemon.pid")
  echo "Daemon PID: $PID"
else
  echo "Daemon PID: UNKNOWN"
fi

# What the symlink points to
if [ -L "$DIST_DIR/current" ]; then
  TARGET=$(readlink "$DIST_DIR/current")
  echo "Symlink 'current' -> $TARGET"
else
  echo "Symlink 'current': NOT SET"
fi

# Compare
if [ -f "$RUNTIME_DIR/daemon.binary" ] && [ -L "$DIST_DIR/current" ]; then
  RUNNING=$(cat "$RUNTIME_DIR/daemon.binary")
  TARGET=$(readlink "$DIST_DIR/current")
  TARGET_NAME="${TARGET%.js}"
  if [ "$RUNNING" = "$TARGET_NAME" ]; then
    echo ""
    echo "✅ ACTIVATED: Running process matches deployed binary."
  else
    echo ""
    echo "❌ GAP DETECTED: Running process uses '$RUNNING' but symlink points to '$TARGET'"
    echo "   The daemon needs to be restarted to pick up the new binary."
  fi
fi
