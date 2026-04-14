#!/usr/bin/env bash
# workspace-cleanup.sh — Prune stale workspace archives across all agents.
#   No args  = dry run (show what would be deleted)
#   --apply  = actually delete files
set -euo pipefail

APPLY=false
[[ "${1:-}" == "--apply" ]] && APPLY=true

MAX_AGE_DAYS=30
MAX_BYTES=$((2 * 1024 * 1024))  # 2 MB

ARCHIVE_GLOB="agents/*/workspace/archive"
TOTAL_FREED=0

# Ensure we're running from the project root
if [[ ! -d agents ]]; then
  echo "ERROR: Run from project root (agents/ directory not found)" >&2
  exit 1
fi

if $APPLY; then
  echo "=== WORKSPACE CLEANUP (APPLY MODE) ==="
else
  echo "=== WORKSPACE CLEANUP (DRY RUN — pass --apply to delete) ==="
fi
echo ""

for archive_dir in $ARCHIVE_GLOB; do
  [[ -d "$archive_dir" ]] || continue
  agent=$(echo "$archive_dir" | cut -d/ -f2)
  agent_freed=0
  deleted_files=()

  # --- Phase 1: Delete files older than MAX_AGE_DAYS ---
  while IFS= read -r -d '' file; do
    size=$(stat -c%s "$file" 2>/dev/null || echo 0)
    if $APPLY; then
      rm -f "$file"
    fi
    deleted_files+=("$file")
    agent_freed=$((agent_freed + size))
  done < <(find "$archive_dir" -type f -mtime +$MAX_AGE_DAYS -print0 2>/dev/null)

  # --- Phase 2: If still over MAX_BYTES, delete oldest files first ---
  if $APPLY; then
    current_bytes=$(du -sb "$archive_dir" | cut -f1)
  else
    current_bytes=$(( $(du -sb "$archive_dir" | cut -f1) - agent_freed ))
  fi

  if (( current_bytes > MAX_BYTES )); then
    # List remaining files oldest-first (by mtime)
    while IFS=$'\t' read -r mtime size file; do
      (( current_bytes <= MAX_BYTES )) && break
      # Skip if already marked for deletion in phase 1
      already=false
      for d in "${deleted_files[@]+"${deleted_files[@]}"}"; do
        [[ "$d" == "$file" ]] && { already=true; break; }
      done
      $already && continue

      if $APPLY; then
        rm -f "$file"
      fi
      deleted_files+=("$file")
      agent_freed=$((agent_freed + size))
      current_bytes=$((current_bytes - size))
    done < <(find "$archive_dir" -type f -printf '%T@\t%s\t%p\n' 2>/dev/null | sort -n)
  fi

  # --- Report for this agent ---
  if (( ${#deleted_files[@]} > 0 )); then
    printf "%-15s  %3d files  %s freed\n" "$agent" "${#deleted_files[@]}" "$(numfmt --to=iec $agent_freed)"
    for f in "${deleted_files[@]}"; do
      echo "  $f"
    done
    echo ""
    TOTAL_FREED=$((TOTAL_FREED + agent_freed))
  fi
done

# --- Clean up empty directories left behind ---
if $APPLY; then
  find $ARCHIVE_GLOB -type d -empty -delete 2>/dev/null || true
fi

echo "-------------------------------------------"
if $APPLY; then
  printf "Total freed: %s\n" "$(numfmt --to=iec $TOTAL_FREED)"
else
  printf "Total would free: %s\n" "$(numfmt --to=iec $TOTAL_FREED)"
  echo "(pass --apply to actually delete)"
fi
