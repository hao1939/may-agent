#!/usr/bin/env bash
# measure-hypotheses-resolved.sh — bob.hypotheses-resolved collector
#
# Emits a single number on stdout: fraction of agents/shared/knowledge/hypotheses/H-*.md
# files whose "Status" line carries a resolved verdict. Consumed by metrics-snapshot
# (source='command' metric bob.hypotheses-resolved).
#
# Run from /app (project root).
set -eu

HYP_DIR="agents/shared/knowledge/hypotheses"
RESOLVED_RE='^\*?\*?[Ss]tatus\*?\*?:?.*(confirmed|disconfirmed|rejected|concluded|resolved|archived|supported)'

tot=$(find "$HYP_DIR" -maxdepth 1 -name 'H-*.md' 2>/dev/null | wc -l | tr -d ' ')
if [ "${tot:-0}" -eq 0 ]; then
  echo "0"
  exit 0
fi

res=$(grep -liE "$RESOLVED_RE" "$HYP_DIR"/H-*.md 2>/dev/null | wc -l | tr -d ' ')
awk -v r="$res" -v t="$tot" 'BEGIN { printf "%.4f", r/t }'
