#!/usr/bin/env bash
# batch-merge.sh — Batch merge tool for review branches.
# Merges multiple branches into main with automatic conflict resolution (--ours).
#
# Usage:
#   scripts/batch-merge.sh                          Merge all review/* branches
#   scripts/batch-merge.sh 'hotfix/*'               Merge branches matching pattern
#   scripts/batch-merge.sh branch1 branch2 branch3  Merge explicit list of branches
#   scripts/batch-merge.sh --dry-run                List matching branches without merging
#   scripts/batch-merge.sh --yes                    Skip confirmation prompt
#   scripts/batch-merge.sh --help                   Show this help
#
# Exit codes:
#   0 = all branches merged successfully (or dry-run / no branches found)
#   1 = validation error (bad args, not on git repo, etc.)
#   2 = one or more branches failed to merge
#
# What it does:
#   1. Finds branches matching pattern (default: review/*) or uses explicit branch list
#   2. Shows list and asks for confirmation (unless --yes)
#   3. For each branch:
#      a. Checks out main
#      b. Merges with --no-edit (REVIEW_GATE_BYPASS=1)
#      c. On conflict: resolves via `git checkout --ours .` + `git add -A` + `git commit --no-edit`
#      d. Deletes the merged branch
#   4. Prints summary: merged count, conflict count, failure count
#   5. Auto-stashes dirty working tree before starting

set -euo pipefail

# --- Helpers ---

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()  { echo -e "${CYAN}ℹ${RESET}  $*"; }
ok()    { echo -e "${GREEN}✓${RESET}  $*"; }
warn()  { echo -e "${YELLOW}⚠${RESET}  $*"; }
err()   { echo -e "${RED}✗${RESET}  $*" >&2; }

# State tracking for cleanup
STASHED=false
ORIGINAL_BRANCH=""

cleanup() {
  local exit_code=$?
  # Return to main (desired end state) — if we can't, try original branch
  if [[ "$(git rev-parse --abbrev-ref HEAD 2>/dev/null)" != "main" ]]; then
    git checkout main --quiet 2>/dev/null || {
      if [[ -n "$ORIGINAL_BRANCH" ]]; then
        git checkout "$ORIGINAL_BRANCH" --quiet 2>/dev/null || true
      fi
    }
  fi
  # Restore stash
  if [[ "$STASHED" == true ]]; then
    warn "Restoring stashed changes..."
    if ! git stash pop --quiet 2>/dev/null; then
      warn "git stash pop had conflicts — your changes are in stash@{0}"
      warn "Run 'git stash show' to inspect, 'git checkout -- <file> && git stash pop' to resolve"
    fi
  fi
  exit "$exit_code"
}

trap cleanup EXIT

# --- Usage ---

usage() {
  cat <<'EOF'
batch-merge.sh — Batch merge tool for review branches

Usage:
  scripts/batch-merge.sh [OPTIONS] [PATTERN | BRANCH...]

Options:
  --dry-run   List matching branches without merging
  --yes       Skip confirmation prompt
  --help, -h  Show this help

Arguments:
  If no arguments (other than flags), merges all local review/* branches.
  A single argument containing * or ? is treated as a branch pattern.
  Multiple arguments are treated as explicit branch names.

Conflict resolution:
  Conflicts are auto-resolved using --ours (keep main's version),
  so the merge always succeeds. Conflicted merges are reported in the summary.

Examples:
  scripts/batch-merge.sh                              # merge all review/* branches
  scripts/batch-merge.sh --dry-run                    # list review/* branches
  scripts/batch-merge.sh 'feature/*'                  # merge all feature/* branches
  scripts/batch-merge.sh --yes review/a review/b      # merge two specific branches, no prompt
  scripts/batch-merge.sh --dry-run 'hotfix/*'         # list hotfix/* branches

Exit codes:
  0 = success (all merged, or dry-run, or no branches found)
  1 = validation error
  2 = one or more branches failed to merge
EOF
}

# --- Argument parsing ---

DRY_RUN=false
AUTO_YES=false
POSITIONAL=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help|-h)
      usage
      exit 0
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --yes|-y)
      AUTO_YES=true
      shift
      ;;
    -*)
      err "Unknown option: $1"
      echo ""
      usage
      exit 1
      ;;
    *)
      POSITIONAL+=("$1")
      shift
      ;;
  esac
done

# --- Determine branch list ---

BRANCHES=()

if [[ ${#POSITIONAL[@]} -eq 0 ]]; then
  # Default: all review/* branches
  PATTERN="review/*"
  while IFS= read -r branch; do
    branch="$(echo "$branch" | sed 's/^[* ]*//')"
    [[ -n "$branch" ]] && BRANCHES+=("$branch")
  done < <(git branch --list "$PATTERN" 2>/dev/null)
elif [[ ${#POSITIONAL[@]} -eq 1 ]] && [[ "${POSITIONAL[0]}" == *'*'* || "${POSITIONAL[0]}" == *'?'* ]]; then
  # Single glob pattern
  PATTERN="${POSITIONAL[0]}"
  while IFS= read -r branch; do
    branch="$(echo "$branch" | sed 's/^[* ]*//')"
    [[ -n "$branch" ]] && BRANCHES+=("$branch")
  done < <(git branch --list "$PATTERN" 2>/dev/null)
else
  # Explicit branch list — validate each exists
  for b in "${POSITIONAL[@]}"; do
    if ! git rev-parse --verify "$b" &>/dev/null; then
      err "Branch '${b}' does not exist"
      exit 1
    fi
    BRANCHES+=("$b")
  done
fi

# --- Validate ---

# Must be in a git repo
if ! git rev-parse --git-dir &>/dev/null; then
  err "Not in a git repository"
  exit 1
fi

# Main must exist
if ! git rev-parse --verify main &>/dev/null; then
  err "Branch 'main' does not exist"
  exit 1
fi

ORIGINAL_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")"

if [[ ${#BRANCHES[@]} -eq 0 ]]; then
  info "No branches found matching '${PATTERN:-arguments}'"
  exit 0
fi

# --- Show branch list ---

echo ""
echo -e "${BOLD}=== Batch Merge: ${#BRANCHES[@]} branch(es) ===${RESET}"
echo ""

for branch in "${BRANCHES[@]}"; do
  ahead=$(git rev-list "main..${branch}" --count 2>/dev/null || echo "0")
  echo -e "    ${CYAN}${branch}${RESET}  (${ahead} commit(s) ahead of main)"
done
echo ""

# --- Dry run exits here ---

if [[ "$DRY_RUN" == true ]]; then
  info "Dry run — no changes made"
  exit 0
fi

# --- Confirmation ---

if [[ "$AUTO_YES" == false ]]; then
  echo -en "${BOLD}Merge all ${#BRANCHES[@]} branch(es) into main? [y/N] ${RESET}"
  read -r answer
  if [[ ! "$answer" =~ ^[Yy]$ ]]; then
    info "Aborted"
    exit 0
  fi
  echo ""
fi

# --- Stash dirty working tree ---

if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
  warn "Dirty working tree — stashing changes..."
  git stash push -m "batch-merge: auto-stash before batch merge" --quiet
  STASHED=true
  ok "Changes stashed"
fi

# --- Merge loop ---

MERGED=0
CONFLICTS=0
FAILURES=0
FAILED_BRANCHES=()

for branch in "${BRANCHES[@]}"; do
  echo -e "${BOLD}--- Merging: ${branch} ---${RESET}"

  # Check commits ahead
  ahead=$(git rev-list "main..${branch}" --count 2>/dev/null || echo "0")
  if [[ "$ahead" -eq 0 ]]; then
    warn "Branch '${branch}' has no commits ahead of main — skipping"
    git branch -d "$branch" --quiet 2>/dev/null || git branch -D "$branch" --quiet 2>/dev/null || true
    ok "Empty branch deleted"
    MERGED=$((MERGED + 1))
    continue
  fi

  # Ensure we're on main
  if [[ "$(git rev-parse --abbrev-ref HEAD)" != "main" ]]; then
    git checkout main --quiet
  fi

  # Attempt merge
  MERGE_FAILED=false
  if REVIEW_GATE_BYPASS=1 git merge "$branch" --no-edit 2>/dev/null; then
    ok "Merged cleanly"
  else
    # Conflict — resolve with --ours
    warn "Conflict detected — resolving with --ours strategy"
    git checkout --ours . 2>/dev/null || true
    git add -A 2>/dev/null || true
    if REVIEW_GATE_BYPASS=1 git commit --no-edit 2>/dev/null; then
      ok "Merged with --ours conflict resolution"
      CONFLICTS=$((CONFLICTS + 1))
    else
      # If commit fails, the merge may be in a bad state — abort
      err "Failed to resolve conflicts for ${branch}"
      git merge --abort 2>/dev/null || true
      MERGE_FAILED=true
      FAILURES=$((FAILURES + 1))
      FAILED_BRANCHES+=("$branch")
    fi
  fi

  # Delete merged branch (skip if merge failed)
  if [[ "$MERGE_FAILED" == false ]]; then
    git branch -d "$branch" --quiet 2>/dev/null || git branch -D "$branch" --quiet 2>/dev/null || warn "Could not delete branch ${branch}"
    MERGED=$((MERGED + 1))
  fi

  echo ""
done

# --- Restore stash ---

if [[ "$STASHED" == true ]]; then
  info "Restoring stashed changes..."
  if git stash pop --quiet 2>/dev/null; then
    STASHED=false
    ok "Stash restored"
  else
    STASHED=false  # prevent double-pop in cleanup
    warn "Stash pop had conflicts with merged changes"
    warn "Your changes are still in git stash — run 'git stash show' to inspect"
  fi
fi

# --- Summary ---

echo -e "${BOLD}=== Summary ===${RESET}"
echo ""
ok "${MERGED} branch(es) merged"
if [[ "$CONFLICTS" -gt 0 ]]; then
  warn "${CONFLICTS} had conflicts (resolved with --ours)"
fi
if [[ "$FAILURES" -gt 0 ]]; then
  err "${FAILURES} failed to merge:"
  for fb in "${FAILED_BRANCHES[@]}"; do
    echo -e "    ${RED}${fb}${RESET}"
  done
fi
echo ""

if [[ "$FAILURES" -gt 0 ]]; then
  exit 2
fi

exit 0
