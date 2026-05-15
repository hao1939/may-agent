#!/usr/bin/env bash
# new-ke.sh — scaffold a new KE-<N>-<slug>.md knowledge entry.
#
# Usage:
#   agents/bob/workspace/scripts/new-ke.sh "<slug-words>" ["<one-line core finding>"]
#
# Auto-increments next KE-<N> by scanning agents/shared/knowledge/entries/.
# Format matches KE-205/206/207.

set -euo pipefail

KE_DIR="agents/shared/knowledge/entries"
if [[ ! -d "$KE_DIR" ]]; then
  echo "ERROR: $KE_DIR not found. Run from repo root." >&2
  exit 1
fi

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <slug-words> [one-line-finding]" >&2
  exit 2
fi

SLUG="$1"
FINDING="${2:-<one-sentence core finding>}"

MAX=$(ls "$KE_DIR" 2>/dev/null \
  | grep -oE '^KE-[0-9]+' \
  | sed 's/^KE-//' \
  | sort -n | tail -1)
MAX=${MAX:-0}
NEXT=$((MAX + 1))
ID=$(printf "KE-%03d" "$NEXT")

FILE="$KE_DIR/${ID}-${SLUG}.md"
if [[ -e "$FILE" ]]; then
  echo "ERROR: $FILE already exists." >&2
  exit 3
fi

TODAY=$(date -u +%Y-%m-%d)

cat > "$FILE" <<EOF
# ${ID}: <Title — what we learned>

**Date**: ${TODAY}
**Source**: <DD-xxx / EXP-xxx / session-id / paper>
**Confidence**: <Low | Medium | Medium-High | High>
**Connects**: <KE-xxx>, <H-xxx>

## Core Finding

${FINDING}

## Evidence

- <data, experiment result, or observation>
- <supporting reference>

## Mechanism / Why

<Causal story. Keep short.>

## Implications

### 1. <short implication>
<details>

### 2. <short implication>
<details>

## Actionable

- <what to do differently — concrete>
- <which agent/workflow should internalize this>

## Open Questions

- <what we still don't know>
EOF

echo "$FILE"
