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
#   --inspect <fields>    Comma-separated session inspection fields. Supported:
#                           finish      — final finish() status + summary
#                           evidence    — verification_evidence items from finish
#                           guards      — guard/verification markers in session.jsonl
#                           last-tools  — last N tool names before finish (N=10 default)
#                         After each trial, a compact per-trial block is printed
#                         (or merged into the --json record under _inspect).
#   --help                Show this help and exit.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Ensure bun on PATH for host dev runs (the container image already has
# /usr/local/bin/bun on PATH).
if [ -x "$HOME/.bun/bin/bun" ]; then
  export PATH="$HOME/.bun/bin:$PATH"
fi

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
INSPECT=""
INSPECT_LAST_N=10

print_help() {
  sed -n '2,40p' "$0" | sed 's/^# \{0,1\}//'
}

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
    --inspect)    INSPECT="$2"; shift 2 ;;
    --help|-h)    print_help; exit 0 ;;
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

  # ── Inspection block (only when --inspect is set) ─────────────────
  if [ -n "$INSPECT" ] && [ -n "$result_json" ]; then
    local inspect_out
    inspect_out=$(echo "$result_json" | INSPECT_FIELDS="$INSPECT" INSPECT_LAST_N="$INSPECT_LAST_N" \
      INSPECT_VARIANT="$variant" INSPECT_SCENARIO="$scenario" INSPECT_TRIAL="$trial" \
      INSPECT_JSON_MODE="$JSON_OUTPUT" python3 - <<'PY' 2>/dev/null || true
import json, os, re, sys
from pathlib import Path

fields = [f.strip() for f in os.environ.get("INSPECT_FIELDS", "").split(",") if f.strip()]
last_n = int(os.environ.get("INSPECT_LAST_N", "10") or "10")
json_mode = os.environ.get("INSPECT_JSON_MODE", "0") == "1"
variant = os.environ.get("INSPECT_VARIANT", "?")
scenario = os.environ.get("INSPECT_SCENARIO", "?")
trial = os.environ.get("INSPECT_TRIAL", "?")

try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)

sid = d.get("session_id") or ""
session_path = d.get("session_path") or ""
gym_root = d.get("gym_root") or ""

# Resolve session.jsonl location.
candidates = []
if session_path:
    candidates.append(session_path)
    if not session_path.endswith(".jsonl"):
        candidates.append(os.path.join(session_path, "session.jsonl"))
if gym_root and sid:
    candidates.append(os.path.join(gym_root, "state", "sessions", sid, "session.jsonl"))
    candidates.append(os.path.join(gym_root, "state", "sessions", "history", sid, "session.jsonl"))
if sid:
    # Project root fallback.
    root = Path(__file__).resolve() if False else Path.cwd()
    for base in (".state/sessions", ".state/sessions/history"):
        candidates.append(os.path.join(str(root), base, sid, "session.jsonl"))

jsonl_path = None
for c in candidates:
    if c and os.path.isfile(c):
        jsonl_path = c
        break

finish_status = None
finish_summary = None
finish_evidence = []
tool_names = []
guards = []

GUARD_MARKERS = [
    "Evidence-Count Mismatch",
    "VERIFICATION DEPTH",
    "VERIFICATION_GATING",
    "VERIFICATION_FAILURE",
    "GUARD:",
    "no-post-write-verification",
    "T2-no-post-write-verification",
    "GHOST_DELIVERABLE",
]

if jsonl_path:
    try:
        with open(jsonl_path, "r", errors="replace") as f:
            for line in f:
                # Guard marker scan (cheap substring check).
                for m in GUARD_MARKERS:
                    if m in line and m not in guards:
                        guards.append(m)
                # Parse JSONL record.
                try:
                    rec = json.loads(line)
                except Exception:
                    continue
                content = rec.get("content")
                if isinstance(content, list):
                    for item in content:
                        if not isinstance(item, dict):
                            continue
                        itype = item.get("type")
                        iname = item.get("name") or item.get("toolName")
                        if itype in ("tool_use", "toolCall") and iname:
                            tool_names.append(iname)
                            if iname == "finish":
                                args = item.get("arguments") or item.get("input") or {}
                                if isinstance(args, dict):
                                    finish_status = args.get("status") or finish_status
                                    finish_summary = args.get("summary") or finish_summary
                                    ev = args.get("verification_evidence")
                                    if isinstance(ev, list):
                                        finish_evidence = [str(x) for x in ev]
    except Exception:
        pass

def truncate(s, n=140):
    s = re.sub(r"\s+", " ", s or "").strip()
    return s if len(s) <= n else s[: n - 1] + "…"

want = set(fields)
result = {
    "scenario": scenario, "variant": variant, "trial": trial,
    "sid": sid, "session_jsonl": jsonl_path,
}
if "finish" in want:
    result["finish"] = {"status": finish_status, "summary": finish_summary}
if "evidence" in want:
    result["evidence"] = finish_evidence
if "guards" in want:
    result["guards"] = guards
if "last-tools" in want:
    # Exclude the trailing finish call itself from "last-tools" context list.
    names = tool_names[:]
    if names and names[-1] == "finish":
        names = names[:-1]
    result["last_tools"] = names[-last_n:]

if json_mode:
    print(json.dumps(result))
else:
    print(f"=== trial {variant}/{scenario}/{trial} (sid={sid or '?'}) ===")
    if "finish" in want:
        st = finish_status or "?"
        sm = truncate(finish_summary or "", 200)
        print(f'finish: {st} — "{sm}"')
    if "evidence" in want:
        print(f"evidence: [{len(finish_evidence)} items]")
        for e in finish_evidence[:5]:
            print(f"  - {truncate(e, 160)}")
        if len(finish_evidence) > 5:
            print(f"  … +{len(finish_evidence) - 5} more")
    if "guards" in want:
        print(f"guards: {', '.join(guards) if guards else 'none'}")
    if "last-tools" in want:
        lt = result.get("last_tools", [])
        tail = ", ".join(lt) if lt else "(none)"
        print(f"last-tools: {tail}" + (", finish" if tool_names and tool_names[-1] == "finish" else ""))
    if not jsonl_path:
        print(f"(note: session.jsonl not found for sid={sid!r})")
PY
    )
    if [ "$JSON_OUTPUT" -eq 1 ]; then
      # Merge inspect_out (a JSON object) into the last JSONL line in RESULTS_FILE
      if [ -n "$inspect_out" ]; then
        python3 - "$RESULTS_FILE" "$inspect_out" <<'PY' || true
import json, sys
path = sys.argv[1]
try:
    merge = json.loads(sys.argv[2])
except Exception:
    sys.exit(0)
with open(path) as f:
    lines = f.readlines()
if lines:
    try:
        d = json.loads(lines[-1])
        d["_inspect"] = merge
        lines[-1] = json.dumps(d) + "\n"
        with open(path, "w") as f:
            f.writelines(lines)
    except Exception:
        pass
PY
      fi
    else
      # Non-JSON mode: write pre-rendered block to a per-trial file the caller reads.
      if [ -n "$inspect_out" ] && [ -n "${INSPECT_FILE:-}" ]; then
        printf '%s\n' "$inspect_out" > "$INSPECT_FILE"
      fi
    fi
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

      result=$(INSPECT_FILE="$RESULTS_DIR/inspect-${RUN_NUM}.txt" run_one "$scenario" "$variant" "$trial")
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
        if [ -n "$INSPECT" ] && [ -s "$RESULTS_DIR/inspect-${RUN_NUM}.txt" ]; then
          cat "$RESULTS_DIR/inspect-${RUN_NUM}.txt"
        fi
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
