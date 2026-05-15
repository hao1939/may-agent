#!/usr/bin/env bash
# Run a gym scenario and record the result to may.db gym_runs table
# Usage: ./gym-record.sh <scenario> [--agent <name>] [--lab-fork <fork>] [--run-tag <tag>]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
DB="$PROJECT_ROOT/.state/may.db"
GYM_RUNNER="$PROJECT_ROOT/agents/test/gym/run-gym.sh"

SCENARIO=""
AGENT="coder"
LAB_FORK=""
RUN_TAG=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --agent) AGENT="$2"; shift 2 ;;
    --lab-fork) LAB_FORK="$2"; shift 2 ;;
    --run-tag) RUN_TAG="$2"; shift 2 ;;
    *) SCENARIO="$1"; shift ;;
  esac
done

if [[ -z "$SCENARIO" ]]; then
  echo "Usage: $0 <scenario> [--agent <name>] [--lab-fork <fork>] [--run-tag <tag>]" >&2
  exit 1
fi

# Run the scenario
RESULT=$(bash "$GYM_RUNNER" "$SCENARIO" --agent "$AGENT" 2>&1)

# Insert into DB
echo "$RESULT" | export PATH="$PROJECT_ROOT/.state/.bun/bin:$PATH" && bun -e "
import {Database} from 'bun:sqlite';
const db = new Database('$DB');
let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  const r = JSON.parse(input);
  db.run(
    'INSERT INTO gym_runs (agent_name, lab_fork, scenario, passed, score_summary, run_tag, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [r.agent, '${LAB_FORK}' || null, r.scenario, r.passed ? 1 : 0, r.summary, '${RUN_TAG}' || null, Date.now()]
  );
  console.log('Recorded:', r.scenario, 'passed:', r.passed, 'lab_fork:', '${LAB_FORK}' || 'none');
});
"
