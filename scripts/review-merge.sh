#!/usr/bin/env bash
# review-merge.sh — Single-command tool to merge a review branch into main.
# Replaces the manual 7-8 step git review branch merge workflow.
#
# Usage:
#   scripts/review-merge.sh <branch>              Merge with pre-merge checks (tsc + test)
#   scripts/review-merge.sh --no-checks <branch>  Skip tsc/test checks (agents-only changes)
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
  scripts/review-merge.sh <branch>              Merge with pre-merge checks
  scripts/review-merge.sh --no-checks <branch>  Skip tsc/test (agents-only changes)
  scripts/review-merge.sh --help                Show this help

Examples:
  scripts/review-merge.sh review/s_1776113498355_390
  scripts/review-merge.sh --no-checks review/ctx-agent-workflow

Exit codes:
  0 = success
  1 = validation error
  2 = pre-merge checks failed (tsc/test)
  3 = merge conflict or failure
EOF
}

# --- Argument parsing ---

SKIP_CHECKS=false

if [[ $# -eq 0 || "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

if [[ "${1:-}" == "--no-checks" ]]; then
  SKIP_CHECKS=true
  shift
fi

if [[ $# -eq 0 ]]; then
  err "Missing branch name. Usage: scripts/review-merge.sh [--no-checks] <branch>"
  exit 1
fi

BRANCH="$1"

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
  echo ""
  err "Merge FAILED — likely a conflict"
  git merge --abort 2>/dev/null || true
  info "Conflict details would appear above. Resolve manually or abandon this branch."
  exit 3
fi
ok "Merged successfully"

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
