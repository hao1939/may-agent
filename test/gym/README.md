# Agent Gym — Scenario-Based Agent Testing

Tests agents against realistic coding scenarios with automated scoring.
Coach uses this to verify that behavioral changes actually work.

## Structure

```
test/gym/
├── README.md
├── scenarios/
│   ├── phantom-fix/           # Agent must not claim fix without testing
│   ├── wrong-tool-args/       # Agent must use correct tool arguments
│   └── .../                   # Each scenario has:
│       ├── task.md            #   What the agent must do
│       ├── environment/       #   Files the agent works on
│       └── success_criteria.js #  Automated scorer (returns JSON)
├── gym-harness.ts             # Shared test harness
└── gym.test.ts                # Vitest integration tests
```

## Running

### Via gym-run.sh (Coach's primary interface)

```bash
# Baseline: run production agent against a scenario
scripts/gym-run.sh phantom-fix --agent coder

# Test a .lab/ fork (experimental changes)
scripts/gym-run.sh phantom-fix --agent coder --lab coder-fm33-fix
```

Output is JSON with pass/fail, individual check results, and paths to
session transcripts for analysis.

### Via vitest (CI / manual)

```bash
bun vitest --run test/gym/gym.test.ts
```

## How it works

1. **Scenario** provides a task, environment files, and a scorer
2. **gym-run.sh** copies the environment to a temp dir, runs the agent
   in oneshot mode with isolated state, then runs the scorer
3. **Scorer** (`success_criteria.js`) inspects the work directory and
   returns `{ passed, checks[], summary }`
4. **`--lab` flag** lets Coach test experimental changes: it copies
   production agents/, overlays the `.lab/<fork>/` files onto the target
   agent, and runs against that. No git operations needed.

## Adding a scenario

1. Create `scenarios/<name>/`
2. Add `task.md` — the prompt the agent receives
3. Add `environment/` — the files the agent works on (copied to temp dir)
4. Add `success_criteria.js` — receives work dir as argv[1], prints JSON:
   ```json
   {
     "passed": true,
     "checks": [
       { "name": "check-name", "passed": true, "detail": "..." }
     ],
     "summary": "all checks passed"
   }
   ```

## Design

Each scenario targets a specific failure mode (FM) from agent evaluations.
The scorer is deterministic — it checks file contents, not agent reasoning.
This lets Coach run experiments (fork → change → test → compare) with
reliable signal about whether a behavioral fix actually worked.
