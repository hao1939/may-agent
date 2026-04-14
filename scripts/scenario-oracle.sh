#!/usr/bin/env bash
# scenario-oracle.sh — Auto-generate expected outputs for gym scenarios
#
# Given a scenario's environment (buggy code) and a solution patch,
# applies the patch, runs test commands, and captures expected outputs.
# This saves coach 15-20 ops per scenario session by automating the
# manual computation of expected values for success_criteria.js.
#
# Usage:
#   scripts/scenario-oracle.sh <scenario-dir> --patch <patch-file> [--cmd <test-cmd>]
#   scripts/scenario-oracle.sh <scenario-dir> --solution <solution-dir> [--cmd <test-cmd>]
#   scripts/scenario-oracle.sh <scenario-dir> --auto  # try to detect from scenario.json
#
# Examples:
#   # Apply a patch and run default test command
#   scripts/scenario-oracle.sh agents/gym/scenarios/cascading-fix-trap-v3 \
#     --patch fixes/cascading-fix.patch
#
#   # Use a solution directory (overlaid on environment)
#   scripts/scenario-oracle.sh agents/gym/scenarios/my-scenario \
#     --solution agents/gym/scenarios/my-scenario/solution
#
#   # Custom test command
#   scripts/scenario-oracle.sh agents/gym/scenarios/my-scenario \
#     --patch fix.patch --cmd "node test/test.js"
#
# Output: JSON to stdout with:
#   - test_output: raw stdout from test command
#   - test_exit_code: 0 if tests pass
#   - file_contents: key source files after fix
#   - file_diffs: what changed from environment to fixed state
#   - values_extracted: parsed numeric/string values from test output

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Args ──────────────────────────────────────────────────────────────

SCENARIO_DIR=""
PATCH_FILE=""
SOLUTION_DIR=""
TEST_CMD=""
AUTO_MODE=false
KEEP_WORKDIR=false
VERBOSE=false

usage() {
  cat >&2 <<'EOF'
Usage: scenario-oracle.sh <scenario-dir> [options]

Options:
  --patch <file>       Apply this patch file to the environment
  --solution <dir>     Overlay this directory on the environment
  --cmd <command>      Test command to run (default: auto-detect from scenario)
  --auto               Try to auto-detect solution from scenario metadata
  --keep               Keep temp workdir for inspection
  --verbose            Show debug output on stderr
  -h, --help           Show this help
EOF
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --patch)    PATCH_FILE="$2"; shift 2 ;;
    --solution) SOLUTION_DIR="$2"; shift 2 ;;
    --cmd)      TEST_CMD="$2"; shift 2 ;;
    --auto)     AUTO_MODE=true; shift ;;
    --keep)     KEEP_WORKDIR=true; shift ;;
    --verbose)  VERBOSE=true; shift ;;
    -h|--help)  usage ;;
    -*)         echo "Unknown option: $1" >&2; usage ;;
    *)
      if [[ -z "$SCENARIO_DIR" ]]; then
        SCENARIO_DIR="$1"
      else
        echo "Unexpected argument: $1" >&2; usage
      fi
      shift ;;
  esac
done

if [[ -z "$SCENARIO_DIR" ]]; then
  echo "Error: scenario directory required" >&2
  usage
fi

# Resolve to absolute path
if [[ ! "$SCENARIO_DIR" = /* ]]; then
  SCENARIO_DIR="$PROJECT_ROOT/$SCENARIO_DIR"
fi

# ── Validate scenario ────────────────────────────────────────────────

if [[ ! -d "$SCENARIO_DIR" ]]; then
  echo "Error: scenario directory not found: $SCENARIO_DIR" >&2
  exit 1
fi

ENV_DIR="$SCENARIO_DIR/environment"
if [[ ! -d "$ENV_DIR" ]]; then
  echo "Error: no environment/ directory in scenario: $SCENARIO_DIR" >&2
  exit 1
fi

# ── Auto-detect test command ──────────────────────────────────────────

detect_test_cmd() {
  local scenario_dir="$1"
  local env_dir="$scenario_dir/environment"
  
  # 1. Check task.md for "Run the tests with:" pattern
  if [[ -f "$scenario_dir/task.md" ]]; then
    local cmd
    cmd=$(grep -oP '(?:Run.*(?:test|check).*with[:\s]*)[`]([^`]+)[`]' "$scenario_dir/task.md" 2>/dev/null | head -1 | grep -oP '`[^`]+`' | tr -d '`' || true)
    if [[ -n "$cmd" ]]; then
      echo "$cmd"
      return
    fi
    # Try backtick-only pattern
    cmd=$(grep -oP '`(node\s+test/[^`]+)`' "$scenario_dir/task.md" 2>/dev/null | head -1 | tr -d '`' || true)
    if [[ -n "$cmd" ]]; then
      echo "$cmd"
      return
    fi
  fi
  
  # 2. Check for common test files
  if [[ -f "$env_dir/test/test.js" ]]; then
    echo "node test/test.js"
    return
  fi
  if [[ -f "$env_dir/test/check.js" ]]; then
    echo "node test/check.js"
    return
  fi
  if [[ -f "$env_dir/package.json" ]]; then
    local has_test
    has_test=$(node -e "const p=require('$env_dir/package.json'); console.log(p.scripts && p.scripts.test ? p.scripts.test : '')" 2>/dev/null || true)
    if [[ -n "$has_test" && "$has_test" != "undefined" ]]; then
      echo "npm test"
      return
    fi
  fi
  
  # 3. Check success_criteria.js for execSync patterns
  if [[ -f "$scenario_dir/success_criteria.js" ]]; then
    local cmd
    cmd=$(grep -oP 'execSync\(["\x27]([^"\x27]+)["\x27]' "$scenario_dir/success_criteria.js" 2>/dev/null | head -1 | sed "s/execSync([\"']//;s/[\"']//" || true)
    if [[ -n "$cmd" ]]; then
      echo "$cmd"
      return
    fi
  fi
  
  echo ""
}

if [[ -z "$TEST_CMD" ]]; then
  TEST_CMD=$(detect_test_cmd "$SCENARIO_DIR")
  if [[ -z "$TEST_CMD" ]]; then
    $VERBOSE && echo "Warning: could not auto-detect test command" >&2
  fi
fi

$VERBOSE && echo "Test command: $TEST_CMD" >&2

# ── Create workdir ────────────────────────────────────────────────────

WORK_DIR=$(mktemp -d "/tmp/oracle-XXXXXX")
$VERBOSE && echo "Work dir: $WORK_DIR" >&2

cleanup() {
  if ! $KEEP_WORKDIR; then
    rm -rf "$WORK_DIR"
  else
    echo "Keeping work dir: $WORK_DIR" >&2
  fi
}
trap cleanup EXIT

# Copy environment
cp -r "$ENV_DIR/." "$WORK_DIR/"

# ── Apply fix ─────────────────────────────────────────────────────────

if [[ -n "$PATCH_FILE" ]]; then
  # Resolve patch path
  if [[ ! "$PATCH_FILE" = /* ]]; then
    PATCH_FILE="$PROJECT_ROOT/$PATCH_FILE"
  fi
  if [[ ! -f "$PATCH_FILE" ]]; then
    echo "Error: patch file not found: $PATCH_FILE" >&2
    exit 1
  fi
  
  $VERBOSE && echo "Applying patch: $PATCH_FILE" >&2
  
  # Try git apply first, fall back to patch
  if command -v git >/dev/null 2>&1; then
    (cd "$WORK_DIR" && git init -q && git add -A && git commit -q -m "base" && git apply "$PATCH_FILE") 2>/dev/null || \
    (cd "$WORK_DIR" && patch -p1 < "$PATCH_FILE") 2>/dev/null || {
      # Try patch -p0
      (cd "$WORK_DIR" && patch -p0 < "$PATCH_FILE") || {
        echo "Error: could not apply patch" >&2
        exit 1
      }
    }
  else
    (cd "$WORK_DIR" && patch -p1 < "$PATCH_FILE") 2>/dev/null || \
    (cd "$WORK_DIR" && patch -p0 < "$PATCH_FILE") || {
      echo "Error: could not apply patch" >&2
      exit 1
    }
  fi

elif [[ -n "$SOLUTION_DIR" ]]; then
  # Resolve solution dir path
  if [[ ! "$SOLUTION_DIR" = /* ]]; then
    SOLUTION_DIR="$PROJECT_ROOT/$SOLUTION_DIR"
  fi
  if [[ ! -d "$SOLUTION_DIR" ]]; then
    echo "Error: solution directory not found: $SOLUTION_DIR" >&2
    exit 1
  fi
  
  $VERBOSE && echo "Overlaying solution: $SOLUTION_DIR" >&2
  cp -r "$SOLUTION_DIR/." "$WORK_DIR/"

elif $AUTO_MODE; then
  # Check for solution/ dir in scenario
  if [[ -d "$SCENARIO_DIR/solution" ]]; then
    $VERBOSE && echo "Auto-detected solution/ directory" >&2
    cp -r "$SCENARIO_DIR/solution/." "$WORK_DIR/"
  elif [[ -f "$SCENARIO_DIR/solution.patch" ]]; then
    $VERBOSE && echo "Auto-detected solution.patch" >&2
    (cd "$WORK_DIR" && git init -q && git add -A && git commit -q -m "base" && git apply "$SCENARIO_DIR/solution.patch") 2>/dev/null || \
    (cd "$WORK_DIR" && patch -p1 < "$SCENARIO_DIR/solution.patch") 2>/dev/null || {
      echo "Error: could not apply auto-detected patch" >&2
      exit 1
    }
  else
    echo "Error: --auto mode but no solution/ dir or solution.patch found in scenario" >&2
    exit 1
  fi
else
  echo "Error: must specify --patch, --solution, or --auto" >&2
  usage
fi

# ── Capture file diffs ────────────────────────────────────────────────

# Create a diff between original environment and fixed state
DIFF_OUTPUT=""
if command -v diff >/dev/null 2>&1; then
  DIFF_OUTPUT=$(diff -rq "$ENV_DIR" "$WORK_DIR" 2>/dev/null | grep -v "\.git" || true)
fi

# Capture detailed diffs for changed files
DETAILED_DIFFS=""
while IFS= read -r line; do
  if [[ "$line" == *"differ"* ]]; then
    # Extract file path relative to env dir
    local_file=$(echo "$line" | sed "s|Files $ENV_DIR/||" | sed 's| and .*||')
    if [[ -f "$ENV_DIR/$local_file" && -f "$WORK_DIR/$local_file" ]]; then
      file_diff=$(diff -u "$ENV_DIR/$local_file" "$WORK_DIR/$local_file" 2>/dev/null || true)
      DETAILED_DIFFS+="--- $local_file ---
$file_diff
"
    fi
  fi
done <<< "$DIFF_OUTPUT"

# ── Run test command ──────────────────────────────────────────────────

TEST_OUTPUT=""
TEST_EXIT=0
TEST_STDERR=""

if [[ -n "$TEST_CMD" ]]; then
  $VERBOSE && echo "Running: $TEST_CMD" >&2
  
  # Capture both stdout and stderr, plus exit code
  set +e
  TEST_OUTPUT=$(cd "$WORK_DIR" && eval "$TEST_CMD" 2>"$WORK_DIR/_stderr.tmp")
  TEST_EXIT=$?
  TEST_STDERR=$(cat "$WORK_DIR/_stderr.tmp" 2>/dev/null || true)
  rm -f "$WORK_DIR/_stderr.tmp"
  set -e
  
  $VERBOSE && echo "Exit code: $TEST_EXIT" >&2
fi

# ── Capture file contents ────────────────────────────────────────────

# Get all source files in the fixed work dir (excluding node_modules, .git, etc.)
FILE_CONTENTS="{"
FIRST=true
while IFS= read -r -d '' file; do
  rel_path="${file#$WORK_DIR/}"
  # Skip binary/generated files
  case "$rel_path" in
    _gym_*|.git/*|node_modules/*|*.tmp) continue ;;
  esac
  
  content=$(cat "$file" 2>/dev/null || echo "")
  # JSON-escape the content
  escaped=$(echo "$content" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' 2>/dev/null || echo '""')
  
  if ! $FIRST; then FILE_CONTENTS+=","; fi
  FIRST=false
  
  # JSON-escape the path
  escaped_path=$(echo "$rel_path" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))' 2>/dev/null || echo "\"$rel_path\"")
  FILE_CONTENTS+="
    $escaped_path: $escaped"
done < <(find "$WORK_DIR" -type f -not -path "*/.git/*" -not -path "*/node_modules/*" -not -name "_gym_*" -not -name "*.tmp" -print0 | sort -z)
FILE_CONTENTS+="
  }"

# ── Extract values from test output ──────────────────────────────────

# Parse test output for check lines like "✓ name" or "Expected: X / Actual: X"
# Also extract numeric values from structured output
VALUES_EXTRACTED="[]"
if [[ -n "$TEST_OUTPUT" ]]; then
  VALUES_EXTRACTED=$(python3 -c "
import json, re, sys

output = sys.stdin.read()
values = []

# Pattern 1: '✓ name' or '✗ name' followed by Expected/Actual
lines = output.split('\n')
for i, line in enumerate(lines):
    # Check marks
    m = re.match(r'\s*[✓✗]\s+(.+)', line)
    if m:
        check_name = m.group(1).strip()
        passed = '✓' in line
        
        # Look for Expected/Actual on next lines  
        expected = None
        actual = None
        for j in range(i+1, min(i+3, len(lines))):
            em = re.match(r'\s*Expected:\s*(.+)', lines[j])
            am = re.match(r'\s*Actual:\s*(.+)', lines[j])
            if em: expected = em.group(1).strip()
            if am: actual = am.group(1).strip()
        
        entry = {'check': check_name, 'passed': passed}
        if expected: entry['expected'] = expected
        if actual: entry['actual'] = actual
        values.append(entry)

# Pattern 2: 'key: value' or 'key = value'
for line in lines:
    m = re.match(r'\s*(\w[\w\s]*\w)\s*[:=]\s*(\S+.*)$', line)
    if m and not any(c in line for c in ['✓', '✗', 'Expected', 'Actual', '===']):
        key = m.group(1).strip()
        val = m.group(2).strip()
        # Try to parse as number
        try:
            val = float(val) if '.' in val else int(val)
        except:
            pass
        values.append({'key': key, 'value': val})

# Pattern 3: Results summary
m = re.search(r'(\d+)\s+passed.*?(\d+)\s+failed', output)
if m:
    values.append({'summary': {'passed': int(m.group(1)), 'failed': int(m.group(2))}})

print(json.dumps(values, indent=2))
" <<< "$TEST_OUTPUT" 2>/dev/null || echo "[]")
fi

# ── Generate output JSON ─────────────────────────────────────────────

# Escape strings for JSON
escape_json() {
  python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' 2>/dev/null || echo '""'
}

TEST_OUTPUT_JSON=$(echo "$TEST_OUTPUT" | escape_json)
TEST_STDERR_JSON=$(echo "$TEST_STDERR" | escape_json)
DIFF_JSON=$(echo "$DETAILED_DIFFS" | escape_json)
SCENARIO_NAME=$(basename "$SCENARIO_DIR")

cat <<ENDJSON
{
  "scenario": "$SCENARIO_NAME",
  "test_command": "$TEST_CMD",
  "test_exit_code": $TEST_EXIT,
  "test_output": $TEST_OUTPUT_JSON,
  "test_stderr": $TEST_STDERR_JSON,
  "file_diffs": $DIFF_JSON,
  "file_contents": $FILE_CONTENTS,
  "values_extracted": $VALUES_EXTRACTED,
  "oracle_hints": {
    "description": "Use these values to author success_criteria.js checks",
    "product_checks": "Verify test_exit_code=0 and key values from values_extracted",
    "behavior_checks": "Verify file_diffs shows only expected changes (no test/data modifications)",
    "convention_checks": "Verify no debug logging, no hardcoded values, clean code style"
  }
}
ENDJSON

$VERBOSE && echo "Oracle generation complete for: $SCENARIO_NAME" >&2
