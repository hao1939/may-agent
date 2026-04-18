#!/usr/bin/env bash
# kb-find.sh — resolve a knowledge-base ID to its file path(s).
#
# Why: agents routinely probe 3-5 wrong paths to locate a DD/KE/H/EXP file
# (top FM-1.3 pattern, 34+ wasted calls in a 7-day window). The KB uses
# inconsistent naming (DD-770-<slug>.md, dd770-<slug>.md, sometimes multiple
# distinct files share a numeric prefix), so a simple `ls` with a guess
# fails often. This script resolves one ID with a single bash call.
#
# Usage:
#   bash agents/shared/scripts/kb-find.sh DD-770
#   bash agents/shared/scripts/kb-find.sh KE-228
#   bash agents/shared/scripts/kb-find.sh H-092 EXP-099
#
# Output: one absolute path per line per matching file. If multiple files
# match (e.g. two separate DD-772s), prints all. Exit 0 if ≥1 found, 1 if
# none. Prints nothing to stdout on no-match so shell composition is clean.
#
# Implementation: case-insensitive glob over the standard KB roots. No DB,
# no bun dependency — just find(1). ~50ms wall time.

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $(basename "$0") <ID> [<ID>...]" >&2
  echo "       IDs: DD-NNN, KE-NNN, H-NNN, EXP-NNN, CR-NNN, FM-N.N" >&2
  exit 2
fi

# Locate KB root. Script is in agents/shared/scripts/ so KB is ../knowledge.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KB_ROOT="$SCRIPT_DIR/../knowledge"
if [[ ! -d "$KB_ROOT" ]]; then
  echo "ERROR: KB root not found at $KB_ROOT" >&2
  exit 2
fi

found_any=0
for raw_id in "$@"; do
  id="${raw_id,,}"                          # lowercase
  id_nohyphen="${id//-/}"                   # "dd-770" -> "dd770"
  # Case-insensitive match against either the hyphenated or compact form at
  # the start of the basename. Use -iname with two alternatives.
  while IFS= read -r -d '' path; do
    echo "$path"
    found_any=1
  done < <(find "$KB_ROOT" -type f \
              \( -iname "${raw_id}-*.md" -o -iname "${raw_id}.md" \
                 -o -iname "${id_nohyphen}-*.md" -o -iname "${id_nohyphen}.md" \) \
              -print0 2>/dev/null)
done

[[ $found_any -eq 1 ]] || exit 1
