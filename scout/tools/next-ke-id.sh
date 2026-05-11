#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
agents_root="$(cd -- "$script_dir/../.." && pwd)"
entries_dir="${1:-$agents_root/shared/knowledge/entries}"

if [[ ! -d "$entries_dir" ]]; then
  echo "ERROR: knowledge entries directory not found: $entries_dir" >&2
  exit 1
fi

max_id="$(
  find "$entries_dir" -maxdepth 1 -type f -name 'KE-[0-9]*.md' -printf '%f\n' \
    | sed -n 's/^KE-\([0-9][0-9]*\).*\.md$/\1/p' \
    | sort -n \
    | tail -1
)"

if [[ -z "${max_id:-}" ]]; then
  next_id=1
else
  next_id=$((10#$max_id + 1))
fi

printf 'KE-%04d\n' "$next_id"
