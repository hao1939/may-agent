#!/usr/bin/env bash
# EXP-243 Runner: Skill Reframing A/B Test
# Usage: bash agents/shared/knowledge/experiments/EXP-243/run-exp243.sh
#
# Runs scenarios with control (current constraint-style) and treatment (expansion-style) skills.
# Injects skill text by prepending to task.md (restored after each run).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
GYM_RUNNER="$PROJECT_ROOT/test/gym/run-gym.sh"
export GYM_AGENT_BIN="${GYM_AGENT_BIN:-/usr/local/bin/may-agent}"
SCENARIOS_DIR="$PROJECT_ROOT/gym/scenarios"
ARMS_DIR="$SCRIPT_DIR/arms"
RESULTS_DIR="$SCRIPT_DIR/results"

mkdir -p "$RESULTS_DIR"

# Scenarios to test (minus sql-injection which doesn't exist)
SCENARIOS=(cascading-fix-trap optimize-deploy-config knowledge-entry-creation misleading-test-fix)

# Skills mapping: scenario -> relevant control skills (space-separated)
declare -A SCENARIO_SKILLS
SCENARIO_SKILLS[cascading-fix-trap]="error-handling verification"
SCENARIO_SKILLS[optimize-deploy-config]="verification coder-edit-discipline"
SCENARIO_SKILLS[knowledge-entry-creation]="budget-before-act verification"
SCENARIO_SKILLS[misleading-test-fix]="coder-edit-discipline verification"

TRIALS=3  # Start with 3 trials per arm to validate setup, scale to 5 if working
RESULTS_CSV="$RESULTS_DIR/exp243-results.csv"

echo "scenario,arm,trial,passed,checks_passed,checks_total,summary" > "$RESULTS_CSV"

run_trial() {
    local scenario=$1
    local arm=$2  # "control" or "treatment"
    local trial=$3
    local skills_list=${SCENARIO_SKILLS[$scenario]}

    # Build skill injection text
    local skill_text=""
    for skill in $skills_list; do
        if [ "$arm" = "control" ]; then
            skill_text+="$(cat "$PROJECT_ROOT/shared/skills/$skill/SKILL.md")"
        else
            skill_text+="$(cat "$ARMS_DIR/${skill}-expansion.md")"
        fi
        skill_text+=$'\n\n'
    done

    # Backup original task.md
    local task_file="$SCENARIOS_DIR/$scenario/task.md"
    local backup_file="$task_file.exp243-backup"
    cp "$task_file" "$backup_file"

    # Prepend skill text to task.md
    local header="## Relevant Skills (Read Before Starting)\n\n"
    printf "%b%s\n\n---\n\n%s" "$header" "$skill_text" "$(cat "$backup_file")" > "$task_file"

    # Run the gym scenario
    echo "[EXP-243] Running $scenario / $arm / trial $trial..."
    local output
    local exit_code=0
    output=$(bash "$GYM_RUNNER" "$scenario" --agent coder --timeout 4 2>&1) || exit_code=$?

    # Restore original task.md
    cp "$backup_file" "$task_file"
    rm -f "$backup_file"

    # Parse results
    local passed="false"
    local checks_passed=0
    local checks_total=0
    local summary="error"

    if echo "$output" | grep -q '"passed"'; then
        passed=$(echo "$output" | grep -o '"passed":[^,}]*' | head -1 | cut -d: -f2 | tr -d ' ')
        checks_passed=$(echo "$output" | grep -o '"checks_passed":[^,}]*' | head -1 | cut -d: -f2 | tr -d ' ' || echo 0)
        checks_total=$(echo "$output" | grep -o '"checks_total":[^,}]*' | head -1 | cut -d: -f2 | tr -d ' ' || echo 0)
        summary=$(echo "$output" | grep -o '"summary":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "no summary")
    fi

    echo "$scenario,$arm,$trial,$passed,$checks_passed,$checks_total,\"$summary\"" >> "$RESULTS_CSV"
    echo "[EXP-243] $scenario/$arm/$trial: passed=$passed checks=$checks_passed/$checks_total"
}

# Run all trials
echo "=== EXP-243 Phase 0: Skill Reframing A/B Test ==="
echo "Scenarios: ${SCENARIOS[*]}"
echo "Trials per arm: $TRIALS"
echo "Results: $RESULTS_CSV"
echo ""

for scenario in "${SCENARIOS[@]}"; do
    for trial in $(seq 1 $TRIALS); do
        # Alternate arms to reduce temporal bias
        run_trial "$scenario" "control" "$trial"
        run_trial "$scenario" "treatment" "$trial"
    done
done

echo ""
echo "=== Results ==="
cat "$RESULTS_CSV"
echo ""

# Quick summary
control_pass=$(grep ",control," "$RESULTS_CSV" | grep -c "true" || echo 0)
control_total=$(grep -c ",control," "$RESULTS_CSV" || echo 0)
treatment_pass=$(grep ",treatment," "$RESULTS_CSV" | grep -c "true" || echo 0)
treatment_total=$(grep -c ",treatment," "$RESULTS_CSV" || echo 0)

echo "Control: $control_pass/$control_total passed"
echo "Treatment: $treatment_pass/$treatment_total passed"
