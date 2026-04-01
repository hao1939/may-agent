#!/usr/bin/env bash
#
# lab-run.sh — Run a lab experiment (multi-arm A/B comparison).
#
# Reads an experiment design from knowledge/experiments/EXP-XXX/design.json
# and runs each arm multiple times, collecting metrics.
#
# Usage:
#   scripts/lab-run.sh EXP-001
#   scripts/lab-run.sh EXP-001 --dry-run
#
# Experiment design format (design.json):
# {
#   "hypothesis": "H-001",
#   "arms": {
#     "control": { "scenario": "context-npx-avoidance", "agent": "coder", "setup": {} },
#     "treatment": { "scenario": "context-npx-avoidance", "agent": "coder", "setup": { "context_file": "..." } }
#   },
#   "runs_per_arm": 3,
#   "metrics": ["passed", "ops", "duration_ms"]
# }

set -euo pipefail
cd "$(dirname "$0")/.."

EXP_ID="${1:?Usage: lab-run.sh EXP-XXX}"
DRY_RUN=false
[ "${2:-}" = "--dry-run" ] && DRY_RUN=true

EXP_DIR="agents/shared/knowledge/experiments/$EXP_ID"
DESIGN="$EXP_DIR/design.json"
RESULTS_DIR="$EXP_DIR/runs"

if [ ! -f "$DESIGN" ]; then
  echo "No design.json found at $DESIGN"
  echo "Create the experiment design first."
  exit 1
fi

mkdir -p "$RESULTS_DIR"

echo "=== Lab Experiment: $EXP_ID ==="
cat "$DESIGN" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(f'Hypothesis: {d.get(\"hypothesis\", \"?\")}')
print(f'Arms: {list(d[\"arms\"].keys())}')
print(f'Runs per arm: {d[\"runs_per_arm\"]}')
print(f'Metrics: {d[\"metrics\"]}')
"

if $DRY_RUN; then
  echo "[dry-run] Would run $(cat "$DESIGN" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['runs_per_arm'] * len(d['arms']))" ) total runs"
  exit 0
fi

# Run each arm
python3 -c "
import json, subprocess, sys, os, time

with open('$DESIGN') as f:
    design = json.load(f)

results = {}
for arm_name, arm_config in design['arms'].items():
    print(f'\n--- Arm: {arm_name} ---')
    arm_results = []
    
    for run_idx in range(design['runs_per_arm']):
        scenario = arm_config['scenario']
        agent = arm_config.get('agent', 'coder')
        
        # Apply setup (e.g., copy context file)
        setup = arm_config.get('setup', {})
        if 'context_file' in setup:
            src = setup['context_file']
            dst = f'agents/{agent}/context.md'
            if src:
                os.system(f'cp {src} {dst}')
            else:
                os.system(f'rm -f {dst}')
        
        print(f'  Run {run_idx + 1}/{design[\"runs_per_arm\"]}...', end=' ', flush=True)
        
        # Run the gym scenario
        start = time.time()
        result = subprocess.run(
            ['scripts/gym-run.sh', scenario, '--agent', agent],
            capture_output=True, text=True, timeout=420
        )
        duration = time.time() - start
        
        # Parse result
        try:
            output = result.stdout
            json_start = output.index('{')
            data = json.loads(output[json_start:])
            
            run_data = {
                'passed': data.get('passed', False),
                'checks': data.get('checks', []),
                'duration_ms': data.get('duration_ms', int(duration * 1000)),
                'ops': sum(1 for c in data.get('checks', []) if 'ops' in c.get('name', '').lower()),
            }
            
            # Extract specific check results
            for check in data.get('checks', []):
                run_data[f'check_{check[\"name\"]}'] = check['passed']
            
            arm_results.append(run_data)
            status = 'PASS' if run_data['passed'] else 'FAIL'
            print(f'{status} ({int(duration)}s)')
        except Exception as e:
            arm_results.append({'passed': False, 'error': str(e), 'duration_ms': int(duration * 1000)})
            print(f'ERROR ({e})')
    
    results[arm_name] = arm_results

# Clean up any setup changes
for arm_name, arm_config in design['arms'].items():
    setup = arm_config.get('setup', {})
    if 'context_file' in setup:
        agent = arm_config.get('agent', 'coder')
        os.system(f'rm -f agents/{agent}/context.md')

# Write results
results_file = '$RESULTS_DIR/run-' + time.strftime('%Y%m%d-%H%M%S') + '.json'
with open(results_file, 'w') as f:
    json.dump(results, f, indent=2)

# Summary
print(f'\n=== Results ===')
for arm_name, arm_results in results.items():
    passed = sum(1 for r in arm_results if r.get('passed'))
    total = len(arm_results)
    avg_dur = sum(r.get('duration_ms', 0) for r in arm_results) / max(total, 1) / 1000
    print(f'{arm_name}: {passed}/{total} passed, avg {avg_dur:.0f}s')

print(f'\nResults saved to: {results_file}')
"
