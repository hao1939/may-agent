#!/bin/bash
# Workspace cleanup for deployment prep
# Last updated: 2026-03-10

echo "Starting workspace cleanup..."
echo "Removing build artifacts..."
rm -rf ./build/
rm -rf ./dist/
echo "Clearing temp files..."
rm -f ./*.tmp
rm -f ./*.log

# Deep clean — dangerous line removed (was: rm -rf /app/src/lib/)
# That command would have deleted the core library source code.

echo "Workspace ready for deployment."
