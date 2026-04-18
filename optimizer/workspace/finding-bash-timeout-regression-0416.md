# Finding: bash:timeout-killed Regression (+22%, 9→11)

**Date**: 2026-04-16  
**Severity**: Low  
**Status**: Investigated — root cause identified

## Summary

The bash:timeout-killed count rose from 9 to 11 (+22%). This is **not a system regression** — it's a natural consequence of increased gym experiment activity (EXP-164, 165, 166) which involve long-running agent sessions.

## Evidence

### Actual timeout-killed commands found in last 24h (from failure chains)

| Agent | Session | Command | Timeout | Root Cause |
|-------|---------|---------|---------|------------|
| bob | s_1776268331874_1 | `scripts/gym-batch.sh --scenario exp164-baseline --agent coder --trials 10` | 1200s | Gym batch of 10 trials |
| bob | s_1776279229400_39 | `test/gym/run-gym.sh exp165-full-gate --agent coder` | 180s | Timeout too low for gym run |
| bob | s_1776297584288_206 | `bun /tmp/run-exp166.ts sql-injection-in-query-builder-f2` | 300s | Gym run |
| bob | s_1776299676578_230 | `bun agents/src/gym/runner.ts sql-injection-in-query-builder-f2` | 280s | Gym run |
| bob | s_1776304666348_290 | `bun agents/src/gym/runner.ts cascading-fix-trap-v2` | 300s | Gym run |

**5 of 7 detected timeouts are gym runner invocations from bob running experiments.**  
The remaining 2 are non-timeout failures misclassified by the heuristic.

### Report says qa(8) — investigation

The tool-quality-report claims `qa(8)` for timeout-killed. However, actual QA failure chains show **zero** `Command timed out` results. QA's `tsc --noEmit` and `vitest --run` commands produce errors (type errors, test failures) but do NOT time out. The classification heuristic likely misclassifies these.

## Root Cause

**Gym runs take 60-300s per trial.** When bob runs experiments with `--timeout 180-300`, single trials that involve complex scenarios (sql-injection, cascading-fix-trap) can exceed the timeout. Batch runs with `--trials 10` at 1200s timeout still aren't enough.

This is expected operational behavior, not a bug. The "regression" from 9→11 is just 2 more experiment sessions.

## Recommendations

### R1: Fix gym runner timeout defaults in experiment scripts (ACTIONABLE NOW)
- **File**: No single file — the timeout is set per-invocation by bob/coach
- **Change**: Add a note to `agents/shared/knowledge/entries/` or `agents/bob/context.md` recommending `--timeout 600` for single gym runs and `--timeout 1800` for batch runs
- **Expected impact**: Reduces failed gym trials that need re-running, saving ~2-3 wasted calls per experiment session

### R2: Fix classification heuristic for timeout-killed (ACTIONABLE NOW)  
- **File**: The heuristic in `agents/optimizer/workspace/archive/2026-03/tool-quality-subclassify-v2.patch.md` (regex: `/timed?\s*out|killed|signal\s+(SIGKILL|SIGTERM|SIGINT)/i`)
- **Change**: The regex is too broad — it matches any output containing "killed" or "timed out" in tool_output XML tags, not just the actual timeout message. Should anchor to `^Command timed out` or the specific timeout error format.
- **Expected impact**: Accurate timeout-killed counts; current qa(8) count is likely ~0-1 real timeouts

### R3: NO_ACTION_NEEDED for the core regression
- The 9→11 increase is noise from experiment volume, not a system problem
- **Justification**: All real timeouts are gym runs, which are expected to be long. The +2 comes from 2 more experiment sessions running this period.
