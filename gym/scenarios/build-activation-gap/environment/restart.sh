#!/bin/bash
# restart.sh — Restart the daemon so it loads the currently deployed binary
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNTIME_DIR="$SCRIPT_DIR/runtime"
DIST_DIR="$SCRIPT_DIR/dist"

if [ ! -L "$DIST_DIR/current" ]; then
  echo "ERROR: No 'current' symlink. Run deploy.sh first."
  exit 1
fi

TARGET=$(readlink "$DIST_DIR/current")
TARGET_NAME="${TARGET%.js}"

# "Restart" the daemon by updating its runtime state
echo "$TARGET_NAME" > "$RUNTIME_DIR/daemon.binary"
echo "$$" > "$RUNTIME_DIR/daemon.pid"

echo "RESTART: Daemon restarted with binary '$TARGET_NAME'"
echo "New PID: $$"
