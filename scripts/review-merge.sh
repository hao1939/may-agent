#!/usr/bin/env bash
# review-merge.sh — Single-command tool to merge a review branch into main.
# Replaces the manual 7-8 step git review branch merge workflow.
#
# Usage:
#   scripts/review-merge.sh <branch>              Merge with pre-merge checks (tsc + test)
#   scripts/review-merge.sh --no-checks <branch>  Skip tsc/test checks (agents-only changes)
#   scripts/review-merge.sh --batch [--dry-run]   Process all review/* branches
#   scripts/review-merge.sh --auto-resolve=ours <branch>  Auto-resolve workspace file conflicts
#   scripts/review-merge.sh --help                Show this help
#
# Exit codes:
#   0 = success
#   1 = validation error (missing branch, bad args, etc.)
#   2 = pre-merge checks failed (tsc or tests)
#   3 = merge conflict or merge failure
#
# What it does:
#   1. Validates the branch exists and has commits ahead of main
#   2. Shows commit summary and changed files
#   3. Runs pre-merge checks (tsc --noEmit, bun test) on the branch [unless --no-checks]
#   4. Auto-stashes dirty working tree if needed
#   5. Merges branch into main (with REVIEW_GATE_BYPASS for the pre-commit hook)
#   6. Deletes the merged branch on success
#   7. Restores stash; on failure, returns to original branch first
#
# Batch mode (--batch):
#   Processes all review/* branches sequentially. Each branch gets the full
#   merge logic. Reports a summary at the end (merged N, skipped M, failed K).
#   Combine with --no-checks, --dry-run, --auto-resolve=ours as needed.
#
# Auto-resolve (--auto-resolve=ours):
#   When a merge conflict occurs in workspace files (todo.md, PRIORITY-TRACKER.md,
#   journal.md, dispatch-board.md), automatically resolve using --ours strategy
#   (current branch version wins). These files are agent-local and the main branch
#   version is always authoritative during merge.

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
ON_TEMP_BRANCH=false  # true when we've checked out a branch other than the original

cleanup() {
  local exit_code=$?
  # Return to original branch if we moved away and are failing
  if [[ "$ON_TEMP_BRANCH" == true && -n "$ORIGINAL_BRANCH" && "$exit_code" -ne 0 ]]; then
    git checkout "$ORIGINAL_BRANCH" --quiet 2>/dev/null || true
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
review-merge.sh — Merge a review branch into main

Usage:
  scripts/review-merge.sh <branch>                           Merge with pre-merge checks
  scripts/review-merge.sh --no-checks <branch>               Skip tsc/test (agents-only changes)
  scripts/review-merge.sh --batch [--dry-run] [--no-checks]  Process all review/* branches
  scripts/review-merge.sh --auto-resolve=ours <branch>       Auto-resolve workspace conflicts
  scripts/review-merge.sh --help                             Show this help

Flags:
  --batch              Process all review/* branches in one call
  --dry-run            (With --batch) List branches without merging
  --no-checks          Skip tsc/test pre-merge checks
  --auto-resolve=ours  Auto-resolve conflicts in workspace files using ours strategy
                       (todo.md, PRIORITY-TRACKER.md, journal.md, dispatch-board.md)

Examples:
  scripts/review-merge.sh review/s_1776113498355_390
  scripts/review-merge.sh --no-checks review/ctx-agent-workflow
  scripts/review-merge.sh --batch --dry-run
  scripts/review-merge.sh --batch --no-checks --auto-resolve=ours

Exit codes:
  0 = success (batch: all merged or skipped)
  1 = validation error
  2 = pre-merge checks failed (tsc/test)
  3 = merge conflict or failure (batch: at least one failed)
EOF
}

# --- Argument parsing ---

SKIP_CHECKS=false
BATCH_MODE=false
DRY_RUN=false
AUTO_RESOLVE_OURS=false
BRANCH=""

# Workspace files eligible for auto-resolve (agent-local, main version is authoritative)
WORKSPACE_FILES=(
  "todo.md"
  "PRIORITY-TRACKER.md"
  "journal.md"
  "dispatch-board.md"
)

if [[ $# -eq 0 || "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-checks)
      SKIP_CHECKS=true
      shift
      ;;
    --batch)
      BATCH_MODE=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --auto-resolve=ours)
      AUTO_RESOLVE_OURS=true
      shift
      ;;
    --auto-resolve=*)
      err "Unsupported auto-resolve strategy: ${1#--auto-resolve=} (only 'ours' is supported)"
      exit 1
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    -*)
      err "Unknown flag: $1"
      usage
      exit 1
      ;;
    *)
      BRANCH="$1"
      shift
      ;;
  esac
done

# --- Batch mode ---

if [[ "$BATCH_MODE" == true ]]; then
  # Collect all review/* branches
  mapfile -t REVIEW_BRANCHES < <(git branch --list 'review/*' | sed 's/^[* ]*//')

  if [[ ${#REVIEW_BRANCHES[@]} -eq 0 ]]; then
    info "No review/* branches found — nothing to do"
    exit 0
  fi

  echo ""
  echo -e "${BOLD}=== Batch Mode: ${#REVIEW_BRANCHES[@]} review branch(es) ===${RESET}"
  echo ""

  for b in "${REVIEW_BRANCHES[@]}"; do
    echo -e "  ${CYAN}•${RESET} $b"
  done
  echo ""

  if [[ "$DRY_RUN" == true ]]; then
    info "Dry run — would process ${#REVIEW_BRANCHES[@]} branch(es). Exiting."
    exit 0
  fi

  # Process each branch, collecting results
  MERGED=0
  SKIPPED=0
  FAILED=0
  FAILED_BRANCHES=()

  for b in "${REVIEW_BRANCHES[@]}"; do
    echo ""
    echo -e "${BOLD}--- Processing: ${b} ---${RESET}"
    echo ""

    # Build args for recursive call
    ARGS=()
    if [[ "$SKIP_CHECKS" == true ]]; then
      ARGS+=(--no-checks)
    fi
    if [[ "$AUTO_RESOLVE_OURS" == true ]]; then
      ARGS+=(--auto-resolve=ours)
    fi
    ARGS+=("$b")

    # Call ourselves for each branch; capture exit code
    set +e
    bash "$0" "${ARGS[@]}"
    rc=$?
    set -e

    case $rc in
      0)
        MERGED=$((MERGED + 1))
        ;;
      1)
        # Validation error (no commits ahead, etc.) — count as skipped
        SKIPPED=$((SKIPPED + 1))
        ;;
      *)
        FAILED=$((FAILED + 1))
        FAILED_BRANCHES+=("$b (exit $rc)")
        ;;
    esac
  done

  # --- Batch summary ---
  echo ""
  echo -e "${BOLD}=== Batch Summary ===${RESET}"
  echo ""
  echo -e "  ${GREEN}Merged:${RESET}  ${MERGED}"
  echo -e "  ${YELLOW}Skipped:${RESET} ${SKIPPED}"
  echo -e "  ${RED}Failed:${RESET}  ${FAILED}"

  if [[ ${#FAILED_BRANCHES[@]} -gt 0 ]]; then
    echo ""
    echo -e "  ${RED}Failed branches:${RESET}"
    for fb in "${FAILED_BRANCHES[@]}"; do
      echo -e "    ${RED}•${RESET} $fb"
    done
  fi

  echo ""

  if [[ "$FAILED" -gt 0 ]]; then
    exit 3
  fi
  exit 0
fi

# --- Single branch mode (original behavior) ---

if [[ -z "$BRANCH" ]]; then
  err "Missing branch name. Usage: scripts/review-merge.sh [--no-checks] <branch>"
  exit 1
fi

# Validate branch exists
if ! git rev-parse --verify "$BRANCH" &>/dev/null; then
  err "Branch '${BRANCH}' does not exist"
  echo ""
  info "Available review branches:"
  git branch --list 'review/*' | sed 's/^/    /'
  exit 1
fi

# Validate main exists
if ! git rev-parse --verify main &>/dev/null; then
  err "Branch 'main' does not exist"
  exit 1
fi

ORIGINAL_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")"

# Check if branch has any commits ahead of main
AHEAD_COUNT=$(git rev-list "main..${BRANCH}" --count 2>/dev/null || echo "0")
if [[ "$AHEAD_COUNT" -eq 0 ]]; then
  warn "Branch '${BRANCH}' has no commits ahead of main — nothing to merge"
  info "Cleaning up the empty branch..."
  git branch -d "$BRANCH" --quiet 2>/dev/null || true
  ok "Branch deleted"
  exit 0
fi

# --- Step 1: Show summary ---

echo ""
echo -e "${BOLD}=== Review Branch: ${BRANCH} ===${RESET}"
echo ""

info "${AHEAD_COUNT} commit(s) ahead of main:"
echo ""
git log "${BRANCH}" --oneline --not main | sed 's/^/    /'
echo ""

info "Changed files:"
echo ""
git diff --stat "main...${BRANCH}" | sed 's/^/    /'
echo ""

# --- Step 2: Pre-merge checks (unless --no-checks) ---

if [[ "$SKIP_CHECKS" == true ]]; then
  warn "Skipping pre-merge checks (--no-checks)"
  echo ""
else
  echo -e "${BOLD}=== Pre-merge Checks ===${RESET}"
  echo ""

  # Need clean tree to checkout branch
  if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
    warn "Dirty working tree — stashing changes..."
    git stash push -m "review-merge: auto-stash before checking ${BRANCH}" --quiet
    STASHED=true
    ok "Changes stashed"
  fi

  info "Checking out ${BRANCH}..."
  git checkout "$BRANCH" --quiet
  ON_TEMP_BRANCH=true

  info "Running tsc --noEmit..."
  if ! ./node_modules/.bin/tsc --noEmit 2>&1; then
    echo ""
    err "TypeScript check FAILED on ${BRANCH} — aborting merge"
    exit 2
  fi
  ok "TypeScript check passed"

  export PATH=".state/.bun/bin:$PATH"
  info "Running bun test..."
  if ! bun test 2>&1; then
    echo ""
    err "Tests FAILED on ${BRANCH} — aborting merge"
    exit 2
  fi
  ok "Tests passed"
  echo ""
fi

# --- Step 3: Stash + checkout main for merge ---

# If we haven't stashed yet (--no-checks path), stash now
if [[ "$STASHED" == false ]]; then
  if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
    warn "Dirty working tree — stashing changes..."
    git stash push -m "review-merge: auto-stash before merging ${BRANCH}" --quiet
    STASHED=true
    ok "Changes stashed"
  fi
fi

echo -e "${BOLD}=== Merging ===${RESET}"
echo ""

# Make sure we're on main
if [[ "$(git rev-parse --abbrev-ref HEAD)" != "main" ]]; then
  info "Checking out main..."
  git checkout main --quiet
  ON_TEMP_BRANCH=true
fi

# Build merge commit message from branch commits
FIRST_MSG=$(git log "${BRANCH}" --oneline --not main --reverse | head -1 | sed 's/^[a-f0-9]* //')
if [[ "$AHEAD_COUNT" -eq 1 ]]; then
  MERGE_MSG="merge ${BRANCH}: ${FIRST_MSG}"
else
  MERGE_MSG="merge ${BRANCH}: ${FIRST_MSG} (+$((AHEAD_COUNT - 1)) more)"
fi

info "Merging ${BRANCH} into main..."

# REVIEW_GATE_BYPASS needed because the pre-commit hook blocks direct commits to main
if ! REVIEW_GATE_BYPASS=1 git merge "$BRANCH" --no-edit -m "$MERGE_MSG" 2>&1; then
  # Merge failed — check if we can auto-resolve
  if [[ "$AUTO_RESOLVE_OURS" == true ]]; then
    info "Merge had conflicts — attempting auto-resolve for workspace files..."

    # Get list of conflicted files
    CONFLICTED_FILES=()
    mapfile -t CONFLICTED_FILES < <(git diff --name-only --diff-filter=U 2>/dev/null || true)

    if [[ ${#CONFLICTED_FILES[@]} -eq 0 ]]; then
      err "Merge FAILED but no conflicted files detected — aborting"
      git merge --abort 2>/dev/null || true
      exit 3
    fi

    # Check if ALL conflicts are in auto-resolvable workspace files
    ALL_RESOLVABLE=true
    RESOLVED_FILES=()
    NON_RESOLVABLE=()

    for cf in "${CONFLICTED_FILES[@]}"; do
      IS_WORKSPACE=false
      for wf in "${WORKSPACE_FILES[@]}"; do
        # Match workspace files anywhere in path (e.g., agents/tech-lead/workspace/todo.md)
        if [[ "$cf" == *"/$wf" || "$cf" == "$wf" ]]; then
          IS_WORKSPACE=true
          break
        fi
      done
      if [[ "$IS_WORKSPACE" == true ]]; then
        RESOLVED_FILES+=("$cf")
      else
        NON_RESOLVABLE+=("$cf")
        ALL_RESOLVABLE=false
      fi
    done

    # Resolve workspace file conflicts using ours (main's version)
    for rf in "${RESOLVED_FILES[@]}"; do
      git checkout --ours "$rf" 2>/dev/null
      git add "$rf" 2>/dev/null
      ok "Auto-resolved (ours): $rf"
    done

    if [[ "$ALL_RESOLVABLE" == true ]]; then
      # All conflicts resolved — complete the merge
      if REVIEW_GATE_BYPASS=1 git commit --no-edit -m "$MERGE_MSG" 2>&1; then
        ok "Merge completed after auto-resolving ${#RESOLVED_FILES[@]} workspace file(s)"
      else
        err "Failed to commit after auto-resolve — aborting"
        git merge --abort 2>/dev/null || true
        exit 3
      fi
    else
      # Some conflicts can't be auto-resolved
      warn "Auto-resolved ${#RESOLVED_FILES[@]} workspace file(s), but ${#NON_RESOLVABLE[@]} conflict(s) remain:"
      for nr in "${NON_RESOLVABLE[@]}"; do
        echo -e "    ${RED}•${RESET} $nr"
      done
      echo ""
      err "Cannot fully auto-resolve — aborting merge"
      git merge --abort 2>/dev/null || true
      exit 3
    fi
  else
    echo ""
    err "Merge FAILED — likely a conflict"
    info "Tip: use --auto-resolve=ours to auto-resolve workspace file conflicts"
    git merge --abort 2>/dev/null || true
    info "Conflict details would appear above. Resolve manually or abandon this branch."
    exit 3
  fi
else
  ok "Merged successfully"
fi

# --- Step 4: Cleanup ---

info "Deleting branch ${BRANCH}..."
git branch -d "$BRANCH" --quiet 2>/dev/null || git branch -D "$BRANCH" --quiet 2>/dev/null || warn "Could not delete branch"
ok "Branch deleted"

# We're on main now, which is the desired state after a successful merge
ON_TEMP_BRANCH=false

# Restore stash if we had one
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

echo ""
echo -e "${GREEN}${BOLD}✓ Done!${RESET} Merged ${BRANCH} into main"
echo -e "  Commit: ${MERGE_MSG}"
echo ""
