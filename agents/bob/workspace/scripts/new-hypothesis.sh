#!/usr/bin/env bash
# new-hypothesis.sh — scaffold a new H-<N>-<slug>.md hypothesis file.
#
# Usage:
#   agents/bob/workspace/scripts/new-hypothesis.sh "<slug-words>" ["<one-line claim>"]
#
# Auto-increments the next H-<N> id by scanning agents/shared/knowledge/hypotheses/.
# Prints the path of the new file on stdout. Opens with frontmatter + template sections
# matching the established format (see H-166).

set -euo pipefail

HYP_DIR="agents/shared/knowledge/hypotheses"
if [[ ! -d "$HYP_DIR" ]]; then
  echo "ERROR: $HYP_DIR not found. Run from repo root." >&2
  exit 1
fi

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <slug-words> [one-line-claim]" >&2
  echo "  slug-words: hyphen-separated short name, e.g. 'recognition-threshold-binary'" >&2
  exit 2
fi

SLUG="$1"
CLAIM="${2:-<one-sentence claim here>}"

# Find max existing H-<N>
MAX=$(ls "$HYP_DIR" 2>/dev/null \
  | grep -oE '^H-[0-9]+' \
  | sed 's/^H-//' \
  | sort -n | tail -1)
MAX=${MAX:-0}
NEXT=$((MAX + 1))
ID=$(printf "H-%03d" "$NEXT")

FILE="$HYP_DIR/${ID}-${SLUG}.md"
if [[ -e "$FILE" ]]; then
  echo "ERROR: $FILE already exists." >&2
  exit 3
fi

TODAY=$(date -u +%Y-%m-%d)

cat > "$FILE" <<EOF
# ${ID}: <Title — short + specific>

**Created**: ${TODAY} by Bob
**Status**: proposed
**Confidence**: ★★☆☆ (initial estimate)
**Source**: <paper / experiment / observation driving this>
**Connects**: <KE-xxx>, <H-xxx>, <EXP-xxx>

---

## Claim

${CLAIM}

## Mechanism

<Why would this be true? What's the causal story?>

## Evidence

### Supporting
- <data point, citation, or observation>

### Against / missing
- <what would falsify this>

## Predictions

| Condition | Predicted outcome |
|-----------|-------------------|
| <X>       | <Y>               |

## Test Plan

- **Design**: <experiment shape, arms, N per arm>
- **Scenario**: <gym scenario or production measurement>
- **Decision rule**: confirmed if <X>; falsified if <Y>

## Implications if true

- <what changes in our system>

## Links

- Parent / related: <>
- Tracked in: agents/bob/workspace/todo.md
EOF

echo "$FILE"
