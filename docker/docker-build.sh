#!/bin/bash
# docker-build.sh — build the may-agent Docker image
#
# Stages local file: dependencies into pi-deps/ so Docker can COPY them.
# Usage: ./docker/docker-build.sh [docker build args...]

set -e
DOCKER_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$DOCKER_DIR")"
cd "$PROJECT_ROOT"

echo "Staging local dependencies..."
rm -rf pi-deps
mkdir -p pi-deps

# Copy local packages (excluding node_modules and .git)
rsync -a --exclude node_modules --exclude .git /home/hao/pi-mono/packages/agent/ pi-deps/agent/
rsync -a --exclude node_modules --exclude .git /home/hao/pi-mono/packages/ai/ pi-deps/ai/

# Build dependencies if needed
(cd pi-deps/agent && npm install --ignore-scripts 2>/dev/null || true)
(cd pi-deps/ai && npm install --ignore-scripts 2>/dev/null || true)

echo "Building Docker image..."
docker compose -f docker/docker-compose.yml build "$@"

echo "Cleaning up staged deps..."
rm -rf pi-deps

echo "Done. Run with: npm run docker:up"
