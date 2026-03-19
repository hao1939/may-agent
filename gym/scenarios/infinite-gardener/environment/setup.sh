#!/bin/bash
# Setup script for the Infinite Gardener scenario
# Creates the log directory structure including the symlink trap
# Run this AFTER copying the environment to a sandbox

set -e

DIR="$(cd "$(dirname "$0")" && pwd)"

# Create the archive subdirectory
mkdir -p "$DIR/logs/archive"

# Create the symlink loop: logs/archive/current -> ../../logs
# This creates an infinite recursion for naive directory walkers
cd "$DIR/logs/archive"
ln -sf ../../logs current
cd "$DIR"

echo "Environment setup complete. Symlink loop created at logs/archive/current -> ../../logs"
