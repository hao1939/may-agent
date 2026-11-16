#!/bin/bash
# build.sh — Build the application into dist/
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_DIR="$SCRIPT_DIR/src"
DIST_DIR="$SCRIPT_DIR/dist"

mkdir -p "$DIST_DIR"

# Generate a build hash based on source content
BUILD_HASH=$(cat "$SRC_DIR/app.js" | md5sum | cut -c1-8)
BUILD_NAME="app-${BUILD_HASH}"

# "Compile" (copy) the source into dist with the hash name
cp "$SRC_DIR/app.js" "$DIST_DIR/${BUILD_NAME}.js"

echo "BUILD SUCCESS: ${BUILD_NAME}"
echo "Output: dist/${BUILD_NAME}.js"
echo "$BUILD_NAME" > "$DIST_DIR/.last-build"
