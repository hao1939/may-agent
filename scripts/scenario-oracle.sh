#!/usr/bin/env bash
#
# scenario-oracle.sh — Auto-generate expected outputs for gym scenarios.
#
# Takes a scenario + patch (the fix), runs before/after, diffs results,
# and optionally evaluates success_criteria.js — saving coach ~15-20 ops
# of manual expected-output computation per scenario.
#
# Usage:
#   scripts/scenario-oracle.sh <scenario-name> --patch <file.patch>
#   scripts/scenario-oracle.sh <scenario-name> --fix-cmd "sed -i 's/</>=/' validate.js"
#   scripts/scenario-oracle.sh <scenario-name> --auto   (uses known-fix.patch in scenario dir)
#   scripts/scenario-oracle.sh --list                   (list scenarios with success_criteria)
#
# Options:
#   --patch <file>       Path to a unified diff/patch to apply as the fix
#   --fix-cmd <cmd>      Shell command to apply the fix (runs in workdir)
#   --auto               Look for known-fix.patch in the scenario directory
#   --run-cmd <cmd>      Override the command to run (default: auto-detected)
#   --keep               Keep temp directories for inspection
#   --json               Output results as JSON
#   --list               List eligible scenarios
#
# Output:
#   - Before output (stdout/stderr from the buggy state)
#   - After output (stdout/stderr after fix applied)
#   - Diff between before and after
#   - Success criteria results (if success_criteria.js exists)
#
# Examples:
#   # Generate oracle for cascading-error with a patch file:
#   scripts/scenario-oracle.sh cascading-error --patch fixes/cascading-error.patch
#
#   # Use an inline fix command:
#   scripts/scenario-oracle.sh cascading-error --fix-cmd "sed -i 's/< THRESHOLD/>= THRESHOLD/' validate.js"
#
#   # Auto mode (scenario has known-fix.patch):
#   scripts/scenario-oracle.sh cascading-error --auto

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SCENARIOS_DIR="$PROJECT_ROOT/agents/gym/scenarios"

# Ensure bun is available
for _bun_dir in "$PROJECT_ROOT/.state/.bun/bin" "$HOME/.bun/bin"; do
  [ -x "$_bun_dir/bun" ] && { export PATH="$_bun_dir:$PATH"; break; }
done

# ── Colors ──────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
RESET='\033[0m'

# ── Helpers ─────────────────────────────────────────────────────────────

usage() {
  sed -n '/^# Usage:/,/^[^#]/p' "$0" | head -n -1 | sed 's/^# //'
  exit 1
}

log() { echo -e "${BLUE}[oracle]${RESET} $*"; }
ok()  { echo -e "${GREEN}[oracle]${RESET} $*"; }
warn(){ echo -e "${YELLOW}[oracle]${RESET} $*"; }
err() { echo -e "${RED}[oracle]${RESET} $*" >&2; }

cleanup() {
  if [ "${KEEP:-0}" != "1" ]; then
    [ -d "${BEFORE_DIR:-}" ] && rm -rf "$BEFORE_DIR"
    [ -d "${AFTER_DIR:-}" ] && rm -rf "$AFTER_DIR"
  fi
}
trap cleanup EXIT

# ── Auto-detect run command ─────────────────────────────────────────────

detect_run_cmd() {
  local dir="$1"
  
  # Priority 1: package.json "test" script
  if [ -f "$dir/package.json" ]; then
    local test_script
    test_script=$(node -e "
      const p = require('$dir/package.json');
      if (p.scripts && p.scripts.test) console.log(p.scripts.test);
    " 2>/dev/null || true)
    if [ -n "$test_script" ]; then
      echo "$test_script"
      return
    fi
  fi
  
  # Priority 2: test.js exists
  if [ -f "$dir/test.js" ]; then
    echo "node test.js"
    return
  fi
  
  # Priority 3: test/ directory with index
  if [ -f "$dir/test/index.test.js" ]; then
    echo "node test/index.test.js"
    return
  fi
  
  # Priority 4: run.js
  if [ -f "$dir/run.js" ]; then
    echo "node run.js"
    return
  fi
  
  # Priority 5: Look for any *.test.js
  local test_file
  test_file=$(find "$dir" -name '*.test.js' -o -name '*.test.ts' | head -1)
  if [ -n "$test_file" ]; then
    echo "node ${test_file#$dir/}"
    return
  fi
  
  echo ""
}

# ── List mode ───────────────────────────────────────────────────────────

list_scenarios() {
  echo -e "${BOLD}Scenarios with success_criteria.js:${RESET}"
  echo ""
  
  local count=0
  for dir in "$SCENARIOS_DIR"/*/; do
    local name
    name=$(basename "$dir")
    if [ -f "$dir/success_criteria.js" ] && [ -d "$dir/environment" ]; then
      local has_fix=""
      [ -f "$dir/known-fix.patch" ] && has_fix=" ${GREEN}(has known-fix.patch)${RESET}"
      
      local run_cmd
      run_cmd=$(detect_run_cmd "$dir/environment")
      local run_info=""
      [ -n "$run_cmd" ] && run_info=" → ${YELLOW}$run_cmd${RESET}"
      
      echo -e "  ${BOLD}$name${RESET}$run_info$has_fix"
      count=$((count + 1))
    fi
  done
  
  echo ""
  echo -e "${count} eligible scenarios"
}

# ── Parse arguments ─────────────────────────────────────────────────────

SCENARIO=""
PATCH_FILE=""
FIX_CMD=""
AUTO=0
RUN_CMD=""
KEEP=0
JSON_OUTPUT=0

while [ $# -gt 0 ]; do
  case "$1" in
    --list)     list_scenarios; exit 0 ;;
    --patch)    PATCH_FILE="$2"; shift 2 ;;
    --fix-cmd)  FIX_CMD="$2"; shift 2 ;;
    --auto)     AUTO=1; shift ;;
    --run-cmd)  RUN_CMD="$2"; shift 2 ;;
    --keep)     KEEP=1; shift ;;
    --json)     JSON_OUTPUT=1; shift ;;
    --help|-h)  usage ;;
    -*)         err "Unknown option: $1"; usage ;;
    *)          SCENARIO="$1"; shift ;;
  esac
done

if [ -z "$SCENARIO" ]; then
  err "Missing scenario name"
  usage
fi

SCENARIO_DIR="$SCENARIOS_DIR/$SCENARIO"
if [ ! -d "$SCENARIO_DIR" ]; then
  err "Scenario not found: $SCENARIO_DIR"
  exit 1
fi

if [ ! -d "$SCENARIO_DIR/environment" ]; then
  err "Scenario has no environment/ directory: $SCENARIO"
  exit 1
fi

# Resolve fix method
if [ "$AUTO" = "1" ]; then
  if [ -f "$SCENARIO_DIR/known-fix.patch" ]; then
    PATCH_FILE="$SCENARIO_DIR/known-fix.patch"
    log "Using known-fix.patch from scenario directory"
  else
    err "No known-fix.patch found in $SCENARIO_DIR"
    err "Create one with: git diff > $SCENARIO_DIR/known-fix.patch"
    exit 1
  fi
fi

if [ -z "$PATCH_FILE" ] && [ -z "$FIX_CMD" ]; then
  err "Must specify one of: --patch <file>, --fix-cmd <cmd>, or --auto"
  usage
fi

if [ -n "$PATCH_FILE" ] && [ ! -f "$PATCH_FILE" ]; then
  err "Patch file not found: $PATCH_FILE"
  exit 1
fi

# ── Setup work directories ──────────────────────────────────────────────

BEFORE_DIR=$(mktemp -d "/tmp/oracle-before-XXXXXX")
AFTER_DIR=$(mktemp -d "/tmp/oracle-after-XXXXXX")

log "Scenario: ${BOLD}$SCENARIO${RESET}"
log "Before dir: $BEFORE_DIR"
log "After dir:  $AFTER_DIR"

# Copy environment to both dirs
cp -r "$SCENARIO_DIR/environment/." "$BEFORE_DIR/"
cp -r "$SCENARIO_DIR/environment/." "$AFTER_DIR/"

# Install npm deps if package.json exists (but not node_modules)
if [ -f "$BEFORE_DIR/package.json" ] && [ ! -d "$BEFORE_DIR/node_modules" ]; then
  log "Installing dependencies..."
  (cd "$BEFORE_DIR" && npm install --silent 2>/dev/null) || true
  cp -r "$BEFORE_DIR/node_modules" "$AFTER_DIR/node_modules" 2>/dev/null || true
fi

# Detect run command
if [ -z "$RUN_CMD" ]; then
  RUN_CMD=$(detect_run_cmd "$BEFORE_DIR")
fi

if [ -z "$RUN_CMD" ]; then
  warn "Could not auto-detect run command. Use --run-cmd to specify."
  warn "Skipping execution, will only apply patch and run success_criteria."
fi

# ── Run BEFORE state ────────────────────────────────────────────────────

BEFORE_OUTPUT=""
BEFORE_EXIT=0
if [ -n "$RUN_CMD" ]; then
  log "Running BEFORE: $RUN_CMD"
  BEFORE_OUTPUT=$(cd "$BEFORE_DIR" && eval "$RUN_CMD" 2>&1) || BEFORE_EXIT=$?
fi

# ── Apply fix ───────────────────────────────────────────────────────────

log "Applying fix..."
if [ -n "$PATCH_FILE" ]; then
  # Try git apply first (handles unified diffs), fall back to patch
  if ! (cd "$AFTER_DIR" && git apply --no-index "$PATCH_FILE" 2>/dev/null); then
    if ! (cd "$AFTER_DIR" && patch -p0 < "$PATCH_FILE" 2>/dev/null); then
      if ! (cd "$AFTER_DIR" && patch -p1 < "$PATCH_FILE" 2>/dev/null); then
        err "Failed to apply patch with git apply, patch -p0, and patch -p1"
        err "Patch file: $PATCH_FILE"
        exit 1
      fi
    fi
  fi
  ok "Patch applied successfully"
elif [ -n "$FIX_CMD" ]; then
  (cd "$AFTER_DIR" && eval "$FIX_CMD")
  ok "Fix command executed"
fi

# ── Run AFTER state ─────────────────────────────────────────────────────

AFTER_OUTPUT=""
AFTER_EXIT=0
if [ -n "$RUN_CMD" ]; then
  log "Running AFTER: $RUN_CMD"
  AFTER_OUTPUT=$(cd "$AFTER_DIR" && eval "$RUN_CMD" 2>&1) || AFTER_EXIT=$?
fi

# ── Run success_criteria.js if available ────────────────────────────────

CRITERIA_BEFORE=""
CRITERIA_AFTER=""
if [ -f "$SCENARIO_DIR/success_criteria.js" ]; then
  log "Running success_criteria.js on BEFORE state..."
  CRITERIA_BEFORE=$(node "$SCENARIO_DIR/success_criteria.js" "$BEFORE_DIR" 2>&1) || true
  
  log "Running success_criteria.js on AFTER state..."
  CRITERIA_AFTER=$(node "$SCENARIO_DIR/success_criteria.js" "$AFTER_DIR" 2>&1) || true
fi

# ── Generate diff ───────────────────────────────────────────────────────

FILE_DIFF=""
if command -v diff &>/dev/null; then
  FILE_DIFF=$(diff -rq "$BEFORE_DIR" "$AFTER_DIR" --exclude='node_modules' --exclude='.git' 2>/dev/null) || true
fi

# ── Output ──────────────────────────────────────────────────────────────

if [ "$JSON_OUTPUT" = "1" ]; then
  # JSON output for programmatic consumption
  node -e "
    const result = {
      scenario: '$SCENARIO',
      before: {
        output: $(printf '%s' "$BEFORE_OUTPUT" | node -e "process.stdout.write(JSON.stringify(require('fs').readFileSync('/dev/stdin','utf-8')))"),
        exitCode: $BEFORE_EXIT
      },
      after: {
        output: $(printf '%s' "$AFTER_OUTPUT" | node -e "process.stdout.write(JSON.stringify(require('fs').readFileSync('/dev/stdin','utf-8')))"),
        exitCode: $AFTER_EXIT
      },
      criteria: {
        before: $(echo "$CRITERIA_BEFORE" | node -e "
          const s = require('fs').readFileSync('/dev/stdin','utf-8');
          try { process.stdout.write(s.trim()); } catch { process.stdout.write(JSON.stringify(s)); }
        " 2>/dev/null || echo 'null'),
        after: $(echo "$CRITERIA_AFTER" | node -e "
          const s = require('fs').readFileSync('/dev/stdin','utf-8');
          try { process.stdout.write(s.trim()); } catch { process.stdout.write(JSON.stringify(s)); }
        " 2>/dev/null || echo 'null')
      },
      fileChanges: $(printf '%s' "$FILE_DIFF" | node -e "process.stdout.write(JSON.stringify(require('fs').readFileSync('/dev/stdin','utf-8')))"),
      dirs: { before: '$BEFORE_DIR', after: '$AFTER_DIR' }
    };
    console.log(JSON.stringify(result, null, 2));
  "
else
  # Human-readable output
  echo ""
  echo -e "${BOLD}══════════════════════════════════════════════════════════════${RESET}"
  echo -e "${BOLD}  Scenario Oracle: $SCENARIO${RESET}"
  echo -e "${BOLD}══════════════════════════════════════════════════════════════${RESET}"
  echo ""
  
  if [ -n "$RUN_CMD" ]; then
    echo -e "${BOLD}── BEFORE (buggy) ── exit=$BEFORE_EXIT ──${RESET}"
    echo "$BEFORE_OUTPUT"
    echo ""
    echo -e "${BOLD}── AFTER (fixed) ── exit=$AFTER_EXIT ──${RESET}"
    echo "$AFTER_OUTPUT"
    echo ""
    
    if [ -n "$BEFORE_OUTPUT" ] || [ -n "$AFTER_OUTPUT" ]; then
      echo -e "${BOLD}── OUTPUT DIFF ──${RESET}"
      diff <(echo "$BEFORE_OUTPUT") <(echo "$AFTER_OUTPUT") --color=always || true
      echo ""
    fi
  fi
  
  if [ -n "$FILE_DIFF" ]; then
    echo -e "${BOLD}── FILE CHANGES ──${RESET}"
    echo "$FILE_DIFF"
    echo ""
    
    # Show actual content diffs for changed files
    echo -e "${BOLD}── CONTENT DIFF ──${RESET}"
    diff -ru "$BEFORE_DIR" "$AFTER_DIR" --exclude='node_modules' --exclude='.git' --color=always 2>/dev/null || true
    echo ""
  fi
  
  if [ -f "$SCENARIO_DIR/success_criteria.js" ]; then
    echo -e "${BOLD}── SUCCESS CRITERIA (before) ──${RESET}"
    if echo "$CRITERIA_BEFORE" | node -e "
      const s = require('fs').readFileSync('/dev/stdin','utf-8').trim();
      try {
        const j = JSON.parse(s);
        console.log('Passed: ' + j.passed);
        for (const c of j.checks || []) {
          const icon = c.passed ? '✓' : '✗';
          console.log('  ' + icon + ' ' + c.name + ': ' + c.detail);
        }
      } catch { console.log(s); }
    " 2>/dev/null; then true; else echo "$CRITERIA_BEFORE"; fi
    echo ""
    
    echo -e "${BOLD}── SUCCESS CRITERIA (after fix) ──${RESET}"
    if echo "$CRITERIA_AFTER" | node -e "
      const s = require('fs').readFileSync('/dev/stdin','utf-8').trim();
      try {
        const j = JSON.parse(s);
        console.log('Passed: ' + j.passed);
        for (const c of j.checks || []) {
          const icon = c.passed ? '✓' : '✗';
          console.log('  ' + icon + ' ' + c.name + ': ' + c.detail);
        }
      } catch { console.log(s); }
    " 2>/dev/null; then true; else echo "$CRITERIA_AFTER"; fi
    echo ""
  fi
  
  # Summary
  echo -e "${BOLD}── ORACLE SUMMARY ──${RESET}"
  if [ -n "$RUN_CMD" ]; then
    if [ "$BEFORE_EXIT" != "0" ] && [ "$AFTER_EXIT" = "0" ]; then
      ok "Fix turns failing run (exit=$BEFORE_EXIT) into passing (exit=0)"
    elif [ "$BEFORE_EXIT" = "0" ] && [ "$AFTER_EXIT" = "0" ]; then
      warn "Both before and after exit 0 — output diff is the signal"
    elif [ "$AFTER_EXIT" != "0" ]; then
      err "After state still fails (exit=$AFTER_EXIT) — fix may be incomplete"
    fi
  fi
  
  if [ -f "$SCENARIO_DIR/success_criteria.js" ]; then
    local_before_pass=$(echo "$CRITERIA_BEFORE" | node -e "
      try { const j = JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8')); console.log(j.passed); } catch { console.log('unknown'); }
    " 2>/dev/null || echo "unknown")
    local_after_pass=$(echo "$CRITERIA_AFTER" | node -e "
      try { const j = JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8')); console.log(j.passed); } catch { console.log('unknown'); }
    " 2>/dev/null || echo "unknown")
    
    echo -e "  Criteria before: $local_before_pass"
    echo -e "  Criteria after:  $local_after_pass"
    
    if [ "$local_before_pass" = "false" ] && [ "$local_after_pass" = "true" ]; then
      ok "Success criteria go from FAIL → PASS — fix is correct! ✓"
    elif [ "$local_after_pass" = "true" ]; then
      warn "Criteria pass both before and after"
    else
      err "Criteria still fail after fix — patch may be wrong"
    fi
  fi
  
  echo ""
  if [ "$KEEP" = "1" ]; then
    log "Work dirs preserved:"
    log "  Before: $BEFORE_DIR"
    log "  After:  $AFTER_DIR"
  fi
fi
