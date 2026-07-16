#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$HERE/../../../.." && pwd)"
MAY_PROJECT="$REPO_ROOT/projects/may-agent"
TRIALS=3

if [[ "${1:-}" == "--trials" ]]; then
  TRIALS="${2:?missing trial count}"
fi

mapfile -t SCENARIOS < <(
  node -e 'const s=require(process.argv[1]); for (const name of s.scenarios) console.log(name)' "$HERE/suite.json"
)

for ((trial = 1; trial <= TRIALS; trial++)); do
  args=(--agent may --tag "may-alignment-trial-$trial")
  for scenario in "${SCENARIOS[@]}"; do
    args+=(--scenario "$scenario")
  done
  echo "May alignment benchmark: trial $trial/$TRIALS"
  GYM_AGENTS_ROOT="$REPO_ROOT/agents" "$MAY_PROJECT/scripts/gym-baseline.sh" "${args[@]}"
done
