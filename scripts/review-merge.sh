#!/usr/bin/env bash
# review-merge.sh — Single-command tool to merge a review branch into main.
# Replaces the manual 7-8 step git review branch merge workflow.
#
# Usage:
#   scripts/review-merge.sh <branch>        Merge the given branch into main
#   scripts/review-merge.sh --help          Show this help
#
# Exit codes:
#   0 = success
#   1 = validation error (missing branch, bad args, etc.)
#   2 = pre-merge checks failed (tsc or tests)
#   3 = merge failed
#
# What it does:
#   1. Validates the branch exists
#   2. Shows commit summary and changed files
#   3. Runs pre-merge checks (tsc --noEmit, bun test) on the branch
#   4. Auto-stashes dirty working tree if needed
#   5. Merges branch into main with descriptive commit message
#   6. Deletes the merged branch
#   7. Restores stash and original branch on failure

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
CHECKED_OUT_MAIN=false

cleanup() {
  local exit_code=$?
  if [[ "$CHECKED_OUT_MAIN" == true && -n "$ORIGINAL_BRANCH" ]]; then
    git checkout "$ORIGINAL_BRANCH" --quiet 2>/dev/null || true
  fi
  if [[ "$STASHED" == true ]]; then
    warn "Restoring stashed changes..."
    git stash pop --quiet 2>/dev/null || warn "Failed to restore stash — run 'git stash pop' manually"
  fi
  exit "$exit_code"
}

trap cleanup EXIT

# --- Usage ---

usage() {
  echo "review-merge.sh — Merge a review branch into main"
  echo ""
  echo "Usage:"
  echo "  scripts/review-merge.sh <branch>   Merge the given branch into main"
  echo "  scripts/review-merge.sh --help     Show this help"
  echo ""
  echo "Example:"
  echo "  scripts/review-merge.sh review/s_1776113498355_390"
  echo ""
  echo "Exit codes:"
  echo "  0 = success"
  echo "  1 = validation error"
  echo "  2 = pre-merge checks failed"
  echo "  3 = merge failed"
}

# --- Argument validation ---

if [[ $# -eq 0 || "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

BRANCH="$1"

# Validate branch exists
if ! git rev-parse --verify "$BRANCH" &>/dev/null; then
  err "Branch '${BRANCH}' does not exist"
  exit 1
fi

# Validate main exists
if ! git rev-parse --verify main &>/dev/null; then
  err "Branch 'main' does not exist"
  exit 1
fi

# Record where we are now
ORIGINAL_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")"

# --- Step 1-2: Show summary ---

echo ""
echo -e "${BOLD}=== Review Branch Summary: ${BRANCH} ===${RESET}"
echo ""

info "Commits on ${BRANCH} (not on main):"
echo ""
git log "$BRANCH" --oneline --not main | sed 's/^/    /'
echo ""

info "Changed files (vs main):"
echo ""
git diff "main...${BRANCH}" -- src/ test/ --stat | sed 's/^/    /'
echo ""

# --- Step 3: Pre-merge checks on the branch ---

echo -e "${BOLD}=== Pre-merge Checks ===${RESET}"
echo ""

# Stash if dirty (need clean tree to checkout branch for checks)
if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
  warn "Dirty working tree detected — stashing changes..."
  git stash push -m "review-merge: auto-stash before merging ${BRANCH}" --quiet
  STASHED=true
  ok "Changes stashed"
fi

# Checkout the review branch to run checks
info "Checking out ${BRANCH} for pre-merge checks..."
git checkout "$BRANCH" --quiet
CHECKED_OUT_MAIN=true  # enables cleanup to return to original branch

info "Running TypeScript check (tsc --noEmit)..."
if ! ./node_modules/.bin/tsc --noEmit 2>&1; then
  echo ""
  err "TypeScript check failed — aborting merge"
  exit 2
fi
ok "TypeScript check passed"

info "Running tests (bun test)..."
export PATH=".state/.bun/bin:$PATH"
if ! bun test 2>&1; then
  echo ""
  err "Tests failed — aborting merge"
  exit 2
fi
ok "Tests passed"

echo ""

# --- Step 4-5: Merge ---

echo -e "${BOLD}=== Merging ===${RESET}"
echo ""

# Build a descriptive commit message from the branch commits
COMMIT_COUNT=$(git log "$BRANCH" --oneline --not main | wc -l | tr -d ' ')
FIRST_COMMIT_MSG=$(git log "$BRANCH" --oneline --not main --reverse | head -1 | sed 's/^[a-f0-9]* //')

if [[ "$COMMIT_COUNT" -eq 1 ]]; then
  MERGE_MSG="merge ${BRANCH}: ${FIRST_COMMIT_MSG}"
else
  MERGE_MSG="merge ${BRANCH}: ${FIRST_COMMIT_MSG} (+$((COMMIT_COUNT - 1)) more)"
fi

info "Checking out main..."
git checkout main --quiet

info "Merging ${BRANCH}..."
if ! git merge "$BRANCH" -m "$MERGE_MSG" 2>&1; then
  echo ""
  err "Merge failed (conflict?) — aborting"
  git merge --abort 2>/dev/null || true
  # cleanup trap will restore original branch + stash
  exit 3
fi
ok "Merged successfully"

# --- Step 6: Delete branch ---

info "Deleting branch ${BRANCH}..."
git branch -d "$BRANCH" --quiet 2>/dev/null || git branch -D "$BRANCH" --quiet 2>/dev/null || warn "Could not delete branch"
ok "Branch deleted"

# --- Step 7: Restore ---

# Stay on main after successful merge (don't go back to original branch)
CHECKED_OUT_MAIN=false

if [[ "$STASHED" == true ]]; then
  info "Restoring stashed changes..."
  git stash pop --quiet
  STASHED=false
  ok "Stash restored"
fi

echo ""
echo -e "${GREEN}${BOLD}✓ Done!${RESET} Merged ${BRANCH} into main"
echo -e "  Commit message: ${MERGE_MSG}"
echo ""
