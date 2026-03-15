#!/bin/bash
# docker-build.sh — build the may-agent Docker image
#
# Usage: ./docker/docker-build.sh [docker build args...]

set -e
DOCKER_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$DOCKER_DIR")"
cd "$PROJECT_ROOT"

echo "Building Docker image..."
docker compose -f docker/docker-compose.yml build "$@"

echo "Done. Run with: npm run docker:up"
