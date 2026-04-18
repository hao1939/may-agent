#!/usr/bin/env bash
# measure-hypotheses-generated.sh — scout.hypotheses-generated collector
#
# Definition: count of synthesis artifacts (cross-references / CR-*.md) Scout
# produced in the last 7 days. CRs are scout's hypothesis-shaped output —
# they cross-link multiple DDs into a thesis. Pure DD count would reward
# summarizing, not synthesizing; CR count rewards synthesis specifically.
# Aligns with metric description "Am I synthesizing, not just summarizing?"
#
# Emits a single integer on stdout. Run from /app (project root).
set -eu

WORKDIR="agents/scout/workspace"
# CR files live both at workspace root and under cross-references/ and deep-dives/.
n=$(find "$WORKDIR" -maxdepth 3 -type f -name 'cr[0-9]*.md' -mtime -7 2>/dev/null | wc -l | tr -d ' ')
echo "${n:-0}"
