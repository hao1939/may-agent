#!/usr/bin/env bash
# ============================================================================
# check-state runner — Deterministic termination gate for agents
# Implements P14 Deterministic Guardrails / P17 Hybrid Execution
#
# Usage:
#   bash run-checks.sh <checklist-file>
#   bash run-checks.sh --inline "file_exists config.json" "valid_json config.json"
#
# Checklist format (one assertion per line):
#   file_exists config.json
#   valid_json config.json
#   contains config.json "port": 8080
#   exit_zero npx tsc --noEmit
#   matches src/index.ts "export (default|const)"
#   not_empty output.md
#   line_count output.md -gt 10
#   dir_exists src/components
#   no_match src/index.ts "TODO|FIXME|HACK"
#   exit_code false 1
#
# Exit codes:
#   0 — All checks passed
#   1 — One or more checks failed
#   2 — Usage error / bad input
# ============================================================================

set -uo pipefail

# ---- Colors (disabled if not a terminal) ----
if [ -t 1 ]; then
  GREEN="\033[0;32m"
  RED="\033[0;31m"
  YELLOW="\033[0;33m"
  BOLD="\033[1m"
  RESET="\033[0m"
else
  GREEN="" RED="" YELLOW="" BOLD="" RESET=""
fi

# ---- Counters ----
TOTAL=0
PASSED=0
FAILED=0
ERRORS=0

# ---- Helpers ----
pass() {
  local assertion="$1" target="$2" detail="${3:-}"
  TOTAL=$((TOTAL + 1))
  PASSED=$((PASSED + 1))
  local msg="CHECK_STATE:PASS:${assertion}:${target}"
  [ -n "$detail" ] && msg="${msg}:${detail}"
  echo -e "${GREEN}✓${RESET} ${msg}"
}

fail() {
  local assertion="$1" target="$2" detail="${3:-}"
  TOTAL=$((TOTAL + 1))
  FAILED=$((FAILED + 1))
  local msg="CHECK_STATE:FAIL:${assertion}:${target}"
  [ -n "$detail" ] && msg="${msg}:${detail}"
  echo -e "${RED}✗${RESET} ${msg}"
}

error() {
  local msg="$1"
  TOTAL=$((TOTAL + 1))
  ERRORS=$((ERRORS + 1))
  echo -e "${YELLOW}?${RESET} CHECK_STATE:ERROR:${msg}"
}

# ---- Assertion Implementations ----

assert_exists() {
  local path="$1"
  if [ -e "$path" ]; then pass "exists" "$path"
  else fail "exists" "$path" "not_found"; fi
}

assert_file_exists() {
  local path="$1"
  if [ -f "$path" ]; then pass "file_exists" "$path"
  else fail "file_exists" "$path" "not_a_regular_file"; fi
}

assert_dir_exists() {
  local path="$1"
  if [ -d "$path" ]; then pass "dir_exists" "$path"
  else fail "dir_exists" "$path" "not_a_directory"; fi
}

assert_not_empty() {
  local path="$1"
  if [ -s "$path" ]; then pass "not_empty" "$path"
  else fail "not_empty" "$path" "file_empty_or_missing"; fi
}

assert_contains() {
  local path="$1"
  shift
  local text="$*"
  if [ ! -f "$path" ]; then
    fail "contains" "$path" "file_not_found"
    return
  fi
  if grep -qF "$text" "$path" 2>/dev/null; then pass "contains" "$path" "found"
  else fail "contains" "$path" "text_not_found"; fi
}

assert_matches() {
  local path="$1"
  shift
  local pattern="$*"
  if [ ! -f "$path" ]; then
    fail "matches" "$path" "file_not_found"
    return
  fi
  if grep -qE "$pattern" "$path" 2>/dev/null; then pass "matches" "$path" "pattern_matched"
  else fail "matches" "$path" "pattern_not_found"; fi
}

assert_no_match() {
  local path="$1"
  shift
  local pattern="$*"
  if [ ! -f "$path" ]; then
    fail "no_match" "$path" "file_not_found"
    return
  fi
  local rc=0
  grep -qE "$pattern" "$path" 2>/dev/null || rc=$?
  if [ "$rc" -eq 0 ]; then fail "no_match" "$path" "pattern_found"
  else pass "no_match" "$path" "clean"; fi
}

assert_valid_json() {
  local path="$1"
  if [ ! -f "$path" ]; then
    fail "valid_json" "$path" "file_not_found"
    return
  fi
  if python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$path" 2>/dev/null; then
    pass "valid_json" "$path"
  else
    fail "valid_json" "$path" "parse_error"
  fi
}

assert_valid_yaml() {
  local path="$1"
  if [ ! -f "$path" ]; then
    fail "valid_yaml" "$path" "file_not_found"
    return
  fi
  if python3 -c "import yaml,sys; yaml.safe_load(open(sys.argv[1]))" "$path" 2>/dev/null; then
    pass "valid_yaml" "$path"
  else
    fail "valid_yaml" "$path" "parse_error"
  fi
}

assert_exit_zero() {
  local cmd="$*"
  local rc=0
  # SECURITY NOTE (P78 audit): eval is required here to support shell operators
  # (pipes, redirects, &&/||) in checklist commands. Input is safe because:
  # 1. $cmd comes from agent-authored checklist files, not user input
  # 2. P53 bash guard validates all commands before reaching this script
  eval "$cmd" >/dev/null 2>&1 || rc=$?
  if [ "$rc" -eq 0 ]; then pass "exit_zero" "$cmd"
  else fail "exit_zero" "$cmd" "exit:$rc"; fi
}

assert_exit_code() {
  # Last arg is the expected code, everything before is the command
  local args=("$@")
  local expected="${args[-1]}"
  unset 'args[-1]'
  local cmd="${args[*]}"
  local actual=0
  # SECURITY NOTE (P78 audit): eval required for shell operators — see assert_exit_zero
  eval "$cmd" >/dev/null 2>&1 || actual=$?
  if [ "$actual" -eq "$expected" ]; then pass "exit_code" "$cmd" "got:$actual"
  else fail "exit_code" "$cmd" "expected:$expected,got:$actual"; fi
}

assert_line_count() {
  local path="$1" op="$2" n="$3"
  if [ ! -f "$path" ]; then
    fail "line_count" "$path" "file_not_found"
    return
  fi
  local count
  count=$(wc -l < "$path")
  # Trim whitespace from wc output
  count=$(echo "$count" | tr -d '[:space:]')
  if [ "$count" "$op" "$n" ]; then pass "line_count" "$path" "count:$count"
  else fail "line_count" "$path" "count:$count,expected:${op}${n}"; fi
}

# ---- Dispatch ----
run_assertion() {
  local assertion="$1"
  shift
  case "$assertion" in
    exists)       assert_exists "$@" ;;
    file_exists)  assert_file_exists "$@" ;;
    dir_exists)   assert_dir_exists "$@" ;;
    not_empty)    assert_not_empty "$@" ;;
    contains)     assert_contains "$@" ;;
    matches)      assert_matches "$@" ;;
    no_match)     assert_no_match "$@" ;;
    valid_json)   assert_valid_json "$@" ;;
    valid_yaml)   assert_valid_yaml "$@" ;;
    exit_zero)    assert_exit_zero "$@" ;;
    exit_code)    assert_exit_code "$@" ;;
    line_count)   assert_line_count "$@" ;;
    \#*)          ;; # Comment line, skip
    "")           ;; # Empty line, skip
    *)            error "unknown_assertion:$assertion" ;;
  esac
}

# ---- Main ----

usage() {
  echo "Usage:"
  echo "  $0 <checklist-file>"
  echo "  $0 --inline \"assertion1 arg1\" \"assertion2 arg2\" ..."
  exit 2
}

if [ $# -eq 0 ]; then
  usage
fi

echo -e "${BOLD}═══════════════════════════════════════════${RESET}"
echo -e "${BOLD}  check-state: Deterministic Termination Gate${RESET}"
echo -e "${BOLD}  P14 Guardrails / P17 Hybrid Execution${RESET}"
echo -e "${BOLD}═══════════════════════════════════════════${RESET}"
echo ""

if [ "$1" = "--inline" ]; then
  shift
  for assertion_line in "$@"; do
    # shellcheck disable=SC2086
    run_assertion $assertion_line
  done
elif [ -f "$1" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    # Skip empty lines and comments
    trimmed=$(echo "$line" | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')
    [ -z "$trimmed" ] && continue
    [[ "$trimmed" == \#* ]] && continue
    # shellcheck disable=SC2086
    run_assertion $trimmed
  done < "$1"
else
  echo -e "${RED}Error: '$1' is not a file and --inline was not specified.${RESET}"
  usage
fi

# ---- Summary ----
echo ""
echo -e "${BOLD}───────────────────────────────────────────${RESET}"
echo -e "  Total: ${TOTAL}  ${GREEN}Passed: ${PASSED}${RESET}  ${RED}Failed: ${FAILED}${RESET}  ${YELLOW}Errors: ${ERRORS}${RESET}"
echo -e "${BOLD}───────────────────────────────────────────${RESET}"

if [ "$FAILED" -gt 0 ] || [ "$ERRORS" -gt 0 ]; then
  echo -e "${RED}${BOLD}  GATE: BLOCKED — Cannot finish task.${RESET}"
  echo -e "  Fix all failures, then re-run checks."
  exit 1
else
  echo -e "${GREEN}${BOLD}  GATE: PASSED — Safe to finish task.${RESET}"
  exit 0
fi
