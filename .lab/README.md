# .lab/ — Experiment Fork Directory

Lab forks are temporary copies of agent directories used for experiments and growth cycles.

## Current State
Cleaned on 2026-04-14. All stale forks removed (53 directories + 5 archived + 2 loose files).

## Active Forks
None currently. EXP-157 fork (`coder-exp157-action-gate`) will be created when execution begins.

## How Forks Work
- **Create**: Copy an agent dir here → `agents/.lab/<fork-name>/`
- **Test**: `scripts/gym-run.sh <scenario> --agent .lab/<fork-name>`
- **Promote**: `promoteAgent()` in `agents/src/lib/growth.ts` copies fork files to canonical agent
- **Discard**: `discardAgent()` in `agents/src/lib/growth.ts` does `rmSync(forkDir, {recursive: true})` — properly cleans disk

## Cleanup Policy
Forks are cheap to recreate. Delete aggressively when experiments complete.
Old forks from EXP-097 through EXP-156 were removed in this cleanup.
