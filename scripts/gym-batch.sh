#!/usr/bin/env bash
#
# gym-batch.sh — Run gym scenario(s) with variant comparison
#
# Replaces manual sequential gym-run.sh invocations. Instead of 10-26
# individual bash calls to compare baseline vs lab forks, run one command.
#
# Usage:
#   # Compare baseline vs two lab forks, 3 trials each:
#   scripts/gym-batch.sh --scenario judgment-ambiguous-spec --agent coder \
#     --variants baseline,combo,ambig --trials 3
#
#   # Run multiple scenarios (all smoke tier) with a fork, 2 trials:
#   scripts/gym-batch.sh --tier smoke --agent coder \
#     --variants baseline,my-fork --trials 2
#
#   # Single scenario, just baseline, 5 trials (statistical confidence):
#   scripts/gym-batch.sh --scenario hasty-fix --agent coder --trials 5
#
# Options:
#   --scenario <name>     Single scenario to run
#   --tier <tier>         Run all scenarios in tier (smoke, standard, full)
#   --category <cat>      Filter by category
#   --agent <name>        Agent name (default: coder)
#   --variants <list>     Comma-separated: baseline,fork1,fork2 (default: baseline)
#                         "baseline" = no --lab flag; others passed as --lab <name>
#   --trials <n>          Number of trials per variant (default: 1)
#   --timeout <min>       Override timeout in minutes
#   --parallel <n>        Max parallel runs (default: 1 = sequential)
#   --json                Output raw JSON results (for piping)
#   --tag <tag>           Tag for gym-record.ts

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Ensure bun is discoverable
for _bun_dir in "$PROJECT_ROOT/.state/.bun/bin" "$HOME/.bun/bin"; do
  [ -x "$_bun_dir/bun" ] && { export PATH="$_bun_dir:$PATH"; break; }
done

# ── Defaults ────────────────────────────────────────────────────────
AGENT="coder"
SCENARIOS=()
VARIANTS=("baseline")
TRIALS=1
TIMEOUT=""
PARALLEL=1
JSON_OUTPUT=0
LIST_ARGS=()
TAG=""

# ── Parse args ──────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --scenario)   SCENARIOS+=("$2"); shift 2 ;;
    --agent)      AGENT="$2"; shift 2 ;;
    --variants)   IFS=',' read -ra VARIANTS <<< "$2"; shift 2 ;;
    --trials)     TRIALS="$2"; shift 2 ;;
    --timeout)    TIMEOUT="$2"; shift 2 ;;
    --parallel)   PARALLEL="$2"; shift 2 ;;
    --json)       JSON_OUTPUT=1; shift ;;
    --tag)        TAG="$2"; shift 2 ;;
    --tier)       LIST_ARGS+=("--tier" "$2"); shift 2 ;;
    --category)   LIST_ARGS+=("--category" "$2"); shift 2 ;;
    *)            echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

# ── Resolve scenarios ───────────────────────────────────────────────
if [ ${#SCENARIOS[@]} -eq 0 ]; then
  if [ ${#LIST_ARGS[@]} -eq 0 ]; then
    echo "Usage: gym-batch.sh --scenario <name> [--variants baseline,fork1] [--trials N]" >&2
    echo "   or: gym-batch.sh --tier smoke [--variants baseline,fork1] [--trials N]" >&2
    exit 1
  fi
  while IFS= read -r line; do
    name=$(echo "$line" | awk '{print $1}')
    [ -n "$name" ] && SCENARIOS+=("$name")
  done < <("$PROJECT_ROOT/scripts/gym-run.sh" --list "${LIST_ARGS[@]}" 2>&1)
fi

if [ ${#SCENARIOS[@]} -eq 0 ]; then
  echo "No scenarios found." >&2
  exit 1
fi

TOTAL_RUNS=$(( ${#SCENARIOS[@]} * ${#VARIANTS[@]} * TRIALS ))
BATCH_ID="batch_$(date +%s)_$(openssl rand -hex 4)"

# ── Header ──────────────────────────────────────────────────────────
if [ "$JSON_OUTPUT" -eq 0 ]; then
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║  Gym Batch Runner                                          ║"
  echo "╠══════════════════════════════════════════════════════════════╣"
  printf "║  Scenarios: %-47s ║\n" "${#SCENARIOS[@]}"
  printf "║  Variants:  %-47s ║\n" "$(IFS=', '; echo "${VARIANTS[*]}")"
  printf "║  Trials:    %-47s ║\n" "$TRIALS"
  printf "║  Total:     %-47s ║\n" "$TOTAL_RUNS runs"
  printf "║  Agent:     %-47s ║\n" "$AGENT"
  printf "║  Batch:     %-47s ║\n" "$BATCH_ID"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo ""
fi

# ── Results storage ─────────────────────────────────────────────────
RESULTS_DIR=$(mktemp -d /tmp/gym-batch-XXXXXX)
RESULTS_FILE="$RESULTS_DIR/results.jsonl"
touch "$RESULTS_FILE"

# ── Run function ────────────────────────────────────────────────────
run_one() {
  local scenario="$1"
  local variant="$2"
  local trial="$3"
  local run_args=("$scenario" "--agent" "$AGENT")

  if [ "$variant" != "baseline" ]; then
    run_args+=("--lab" "$variant")
  fi
  if [ -n "$TIMEOUT" ]; then
    run_args+=("--timeout" "$TIMEOUT")
  fi

  local tmpout
  tmpout=$(mktemp /tmp/gym-run-XXXXXX.txt)
  local exit_code=0
  "$PROJECT_ROOT/scripts/gym-run.sh" "${run_args[@]}" > "$tmpout" 2>&1 || exit_code=$?

  # Extract JSON result
  local json_start
  json_start=$(grep -nE '^\s*[\[{]' "$tmpout" | head -1 | cut -d: -f1)
  local result_json=""
  if [ -n "$json_start" ]; then
    result_json=$(tail -n +"$json_start" "$tmpout" 2>/dev/null || true)
  fi

  local passed="unknown"
  local checks="?"
  if [ -n "$result_json" ]; then
    passed=$(echo "$result_json" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    cs = d.get('checks', [])
    if d.get('passed') or (cs and all(c.get('passed') for c in cs)):
        print('true')
    else:
        print('false')
except:
    print('error')
" 2>/dev/null || echo "error")
    checks=$(echo "$result_json" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    cs = d.get('checks', [])
    p = sum(1 for c in cs if c.get('passed'))
    print(f'{p}/{len(cs)}')
except:
    print('?')
" 2>/dev/null || echo "?")

    # Append structured result to JSONL
    echo "$result_json" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    d['_batch'] = '$BATCH_ID'
    d['_variant'] = '$variant'
    d['_trial'] = $trial
    d['_scenario'] = '$scenario'
    print(json.dumps(d))
except:
    pass
" >> "$RESULTS_FILE" 2>/dev/null
  fi

  rm -f "$tmpout"

  # Return status for display
  if [ "$passed" = "true" ]; then
    echo "PASS|$checks"
  elif [ "$passed" = "false" ]; then
    echo "FAIL|$checks"
  else
    echo "ERROR|$checks"
  fi
}

# ── Execute runs ────────────────────────────────────────────────────
declare -A VARIANT_PASS
declare -A VARIANT_TOTAL
declare -A SCENARIO_RESULTS

RUN_NUM=0
for scenario in "${SCENARIOS[@]}"; do
  for variant in "${VARIANTS[@]}"; do
    for trial in $(seq 1 "$TRIALS"); do
      RUN_NUM=$((RUN_NUM + 1))

      if [ "$JSON_OUTPUT" -eq 0 ]; then
        printf "[%d/%d] %-30s %-15s trial %d ... " "$RUN_NUM" "$TOTAL_RUNS" "$scenario" "$variant" "$trial"
      fi

      result=$(run_one "$scenario" "$variant" "$trial")
      status=$(echo "$result" | cut -d'|' -f1)
      checks=$(echo "$result" | cut -d'|' -f2)

      # Track stats
      key="${scenario}|${variant}"
      VARIANT_TOTAL["$key"]=$(( ${VARIANT_TOTAL["$key"]:-0} + 1 ))
      if [ "$status" = "PASS" ]; then
        VARIANT_PASS["$key"]=$(( ${VARIANT_PASS["$key"]:-0} + 1 ))
      fi

      if [ "$JSON_OUTPUT" -eq 0 ]; then
        case "$status" in
          PASS)  echo "✅ PASS ($checks)" ;;
          FAIL)  echo "❌ FAIL ($checks)" ;;
          ERROR) echo "⚠️  ERROR" ;;
        esac
      fi
    done
  done
done

# ── Summary table ───────────────────────────────────────────────────
if [ "$JSON_OUTPUT" -eq 0 ]; then
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo "  COMPARISON SUMMARY"
  echo "═══════════════════════════════════════════════════════════════"
  echo ""

  # Header row
  printf "%-30s" "Scenario"
  for variant in "${VARIANTS[@]}"; do
    printf " │ %-15s" "$variant"
  done
  echo ""

  # Separator
  printf "%-30s" "──────────────────────────────"
  for variant in "${VARIANTS[@]}"; do
    printf "─┼─%-15s" "───────────────"
  done
  echo ""

  # Data rows
  for scenario in "${SCENARIOS[@]}"; do
    printf "%-30s" "$scenario"
    for variant in "${VARIANTS[@]}"; do
      key="${scenario}|${variant}"
      p=${VARIANT_PASS["$key"]:-0}
      t=${VARIANT_TOTAL["$key"]:-0}
      if [ "$t" -gt 0 ]; then
        pct=$(( p * 100 / t ))
        if [ "$pct" -eq 100 ]; then
          printf " │ ✅ %d/%d (%3d%%)" "$p" "$t" "$pct"
        elif [ "$pct" -eq 0 ]; then
          printf " │ ❌ %d/%d (%3d%%)" "$p" "$t" "$pct"
        else
          printf " │ 🔶 %d/%d (%3d%%)" "$p" "$t" "$pct"
        fi
      else
        printf " │ %-15s" "—"
      fi
    done
    echo ""
  done

  echo ""

  # Variant totals
  printf "%-30s" "TOTAL"
  for variant in "${VARIANTS[@]}"; do
    total_p=0
    total_t=0
    for scenario in "${SCENARIOS[@]}"; do
      key="${scenario}|${variant}"
      total_p=$(( total_p + ${VARIANT_PASS["$key"]:-0} ))
      total_t=$(( total_t + ${VARIANT_TOTAL["$key"]:-0} ))
    done
    if [ "$total_t" -gt 0 ]; then
      pct=$(( total_p * 100 / total_t ))
      printf " │ %d/%d (%3d%%)" "$total_p" "$total_t" "$pct"
    else
      printf " │ %-15s" "—"
    fi
  done
  echo ""

  echo ""
  echo "Batch: $BATCH_ID"
  echo "Results: $RESULTS_FILE"
fi

# ── JSON output mode ────────────────────────────────────────────────
if [ "$JSON_OUTPUT" -eq 1 ]; then
  cat "$RESULTS_FILE"
fi

# ── Cleanup hint ────────────────────────────────────────────────────
# Results preserved at $RESULTS_DIR for further analysis
# Clean up with: rm -rf $RESULTS_DIR
