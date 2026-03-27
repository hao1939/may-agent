#!/bin/bash
# deploy.sh — Update the 'current' symlink to point to the latest build.
# NOTE: This only updates the symlink on disk. The running daemon process
# loaded its binary at startup and will NOT automatically pick up the new
# symlink target. A restart is needed for activation.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_DIR="$SCRIPT_DIR/dist"

if [ ! -f "$DIST_DIR/.last-build" ]; then
  echo "ERROR: No build found. Run build.sh first."
  exit 1
fi

BUILD_NAME=$(cat "$DIST_DIR/.last-build")

if [ ! -f "$DIST_DIR/${BUILD_NAME}.js" ]; then
  echo "ERROR: Build artifact $BUILD_NAME.js not found in dist/"
  exit 1
fi

# Update the symlink
cd "$DIST_DIR"
rm -f current
ln -s "${BUILD_NAME}.js" current

echo "DEPLOY: Symlink updated: current -> ${BUILD_NAME}.js"
echo ""
echo "⚠️  NOTE: The running daemon still uses the binary it loaded at startup."
echo "   Run 'bash restart.sh' to activate the new binary in the running process."
