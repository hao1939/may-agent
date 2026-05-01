#!/usr/bin/env bash
# measure-findings-used.sh — scout.findings-used collector
#
# Definition: fraction of Scout's deep-dives + cross-references whose ID
# (DD-NNN or CR-NNN) is referenced anywhere in agents/shared/knowledge/
# (i.e. by hypotheses, experiments, findings, synthesis — anyone outside
# scout's own workspace). Measures whether scout's research is actionable
# (consumed downstream) vs. accumulating in the workspace unread.
#
# Emits a single decimal on stdout (0.0000–1.0000). Run from /app.
set -eu

WORKDIR="agents/scout/workspace"
SHARED="agents/shared/knowledge"

# Collect IDs from filenames: dd763-foo.md → DD-763, cr325-bar.md → CR-325.
ids=$(find "$WORKDIR" -maxdepth 3 -type f \( -name 'dd[0-9]*.md' -o -name 'cr[0-9]*.md' \) 2>/dev/null \
  | xargs -n1 basename 2>/dev/null \
  | grep -oiE '^(dd|cr)[0-9]+' \
  | tr 'a-z' 'A-Z' \
  | sed -E 's/^(DD|CR)/\1-/' \
  | sort -u)

tot=$(printf '%s\n' "$ids" | grep -c . || true)
if [ "${tot:-0}" -eq 0 ]; then
  echo "0"
  exit 0
fi

used=0
while IFS= read -r id; do
  [ -z "$id" ] && continue
  if grep -rlq -- "$id" "$SHARED" 2>/dev/null; then
    used=$((used + 1))
  fi
done <<EOF
$ids
EOF

awk -v u="$used" -v t="$tot" 'BEGIN { printf "%.4f", u/t }'
