#!/bin/bash
# Build script — compiles TypeScript files to dist/
set -e

echo "Building project..."
mkdir -p dist
cp src/*.tx dist/
echo "Build complete. Output in dist/"
