#!/usr/bin/env bash
# new-experiment.sh — scaffold a new EXP-<N>/ experiment directory.
#
# Usage:
#   agents/bob/workspace/scripts/new-experiment.sh "<slug-words>" ["<research question>"]
#
# Creates agents/shared/knowledge/experiments/EXP-<N>/ with design.md and results.md.
# Auto-increments next EXP-<N> by scanning the experiments dir.

set -euo pipefail

EXP_DIR="agents/shared/knowledge/experiments"
if [[ ! -d "$EXP_DIR" ]]; then
  echo "ERROR: $EXP_DIR not found. Run from repo root." >&2
  exit 1
fi

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <slug-words> [research-question]" >&2
  exit 2
fi

SLUG="$1"
RQ="${2:-<one-sentence research question>}"

MAX=$(ls "$EXP_DIR" 2>/dev/null \
  | grep -oE '^EXP-[0-9]+' \
  | sed 's/^EXP-//' \
  | sort -n | tail -1)
MAX=${MAX:-0}
NEXT=$((MAX + 1))
ID=$(printf "EXP-%03d" "$NEXT")

DIR="$EXP_DIR/${ID}"
if [[ -e "$DIR" ]]; then
  echo "ERROR: $DIR already exists." >&2
  exit 3
fi

mkdir -p "$DIR"
TODAY=$(date -u +%Y-%m-%d)

cat > "$DIR/design.md" <<EOF
# ${ID}: <Short title — ${SLUG}>

**Date**: ${TODAY}
**Status**: DESIGNED
**Predecessor**: <EXP-xxx or "none">
**Hypothesis**: <H-xxx>

---

## Research Question

${RQ}

## Hypothesis

- **H-${NEXT}a**: <primary prediction>
- **H-${NEXT}-null**: <null / no-effect case>

## Design

### Arms

| Arm | Intervention | N | Notes |
|-----|-------------|---|-------|
| A   | baseline    |   |       |
| B   | <treatment> |   |       |

### Scenario

- <gym scenario name or production measurement>

### Metrics

- Primary: <pass rate / op count / quality>
- Secondary: <>

### Decision Rule

- Confirmed if: <>
- Falsified if: <>

## Execution

\`\`\`bash
# scripts/gym-run.sh <scenario> --agent <name> --tag ${ID}
\`\`\`
EOF

cat > "$DIR/results.md" <<EOF
# ${ID}: Results

**Status**: PENDING

## Summary

<one-paragraph outcome — fill after runs complete>

## Data

| Arm | N | Pass rate | Notes |
|-----|---|-----------|-------|
| A   |   |           |       |
| B   |   |           |       |

## Analysis

<what the numbers mean>

## Conclusion

<confirmed / falsified / inconclusive + what changes>

## Followups

- <next experiment or KE to write>
EOF

echo "$DIR"
