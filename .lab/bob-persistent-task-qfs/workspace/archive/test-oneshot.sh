#!/bin/bash
# Verify Bob in oneshot mode
# We use bundle/may-agent if available (faster/no deps), else fail because vite-node needs newer node.

if [ -f "bundle/may-agent" ]; then
  echo "Using compiled binary..."
  ./bundle/may-agent --oneshot --agent bob --task "echo hello"
else
  echo "No binary found. Cannot run oneshot."
  exit 1
fi
