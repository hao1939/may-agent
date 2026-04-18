#!/bin/bash
# P82 Enforcement Script
# Adds "coordination" tool preset to all agent.json files if missing.
# This enables the `handoff` tool for structural protocol compliance.

AGENTS_ROOT="agents"

for agent_dir in "$AGENTS_ROOT"/*; do
  if [ -d "$agent_dir" ]; then
    config_file="$agent_dir/agent.json"
    if [ -f "$config_file" ]; then
      # Check if "coordination" is already present
      if ! grep -q '"coordination"' "$config_file"; then
        echo "Patching $config_file..."
        # Insert "coordination" into the tools array
        # Use a temporary file to avoid sed in-place issues
        sed 's/"tools": \[/"tools": \[\n    "coordination",/' "$config_file" > "$config_file.tmp" && mv "$config_file.tmp" "$config_file"
      else
        echo "Skipping $config_file (already has coordination)"
      fi
    fi
  fi
done

echo "P82 Patch Complete. Agents must be restarted."
