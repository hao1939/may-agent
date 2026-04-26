#!/bin/bash
# KE Concept Lookup — Phase 3 of H-EXP-019 (concept-node retrieval)
# Usage: ke-lookup.sh <failure-type-keyword>
# Example: ke-lookup.sh verification
#          ke-lookup.sh "tool waste"
#          ke-lookup.sh compliance
#
# Searches concept-index.md categories and returns matching KE entries.
# Multiple keywords can be space-separated for broader search.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INDEX="$SCRIPT_DIR/concept-index.md"

if [ $# -eq 0 ]; then
  echo "Usage: ke-lookup.sh <keyword> [keyword2 ...]"
  echo ""
  echo "Available categories:"
  grep "^## " "$INDEX" | sed 's/## /  /'
  exit 0
fi

QUERY="$*"

# Step 1: Find matching categories (case-insensitive)
echo "=== KE Lookup: '$QUERY' ==="
echo ""

# Map common failure types to categories
matching_categories=""
for keyword in "$@"; do
  kw=$(echo "$keyword" | tr '[:upper:]' '[:lower:]')
  matches=$(grep "^## " "$INDEX" | grep -i "$kw" | sed 's/^## //' | sed 's/ (.*//')
  if [ -n "$matches" ]; then
    matching_categories="$matching_categories
$matches"
  fi
done

if [ -z "$matching_categories" ]; then
  # Fallback: search KE titles for keyword
  echo "No category match. Searching KE titles..."
  echo ""
  grep -i "$QUERY" "$INDEX" | grep "^\- \[KE-" | head -15
  exit 0
fi

echo "Matching categories:"
echo "$matching_categories" | sort -u | grep -v '^$' | while read -r cat; do
  echo "  → $cat"
done
echo ""

# Step 2: Extract KEs from matching categories
echo "$matching_categories" | sort -u | grep -v '^$' | while read -r cat; do
  echo "--- $cat ---"
  # Extract section between this ## and next ##
  awk "/^## ${cat}/,/^## [^${cat}]/" "$INDEX" | grep "^\- \[KE-" | head -10
  echo ""
done
