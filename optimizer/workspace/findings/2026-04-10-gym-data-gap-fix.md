# Finding: Gym Results Data Gap — No DB Recording from Shell Runner

**Date**: 2026-04-10
**Author**: Optimizer
**Status**: FIXED
**Impact**: ~75 gym sessions over 7 days with 0 DB entries in `gym_runs`

## Problem

The `gym_runs` table in `.state/may.db` was empty despite coach running ~75 gym trials since April 2 through experiment sessions (EXP-117 through EXP-121).

## Root Cause

Two separate gym execution paths exist, but only one records to the DB:

### Path 1: Workflow path (RECORDS ✓)
- `agents/coach/workflows/gym-helpers.ts` → `runGym()` → `recordGymResult()`
- Used by `growth-cycle.ts` and `training-sprint.ts` workflows
- Last used: **March 23** (workflow runs `wr_1774264195004` and `wr_1774253412430`)
- This path correctly records every gym result to the DB

### Path 2: Shell script path (DID NOT RECORD ✗)
- `test/gym/run-gym.sh` → `src/gym/runner.ts` → JSON to stdout
- Used by coach LLM sessions when running experiments directly via `bash`
- Has been the **primary gym execution path since April 2**
- The shell script just outputs JSON and exits — no DB recording whatsoever

Coach switched from workflow-based gym runs to direct bash-based gym runs around April 2 (when experiments became more custom and complex). The recording infrastructure was never added to the shell path.

## Fix

### 1. Created `test/gym/record-result.ts`
A standalone bun script that reads GymResult JSON from stdin and inserts into `gym_runs` + `gym_checks` tables. Handles:
- Single results (normal `run-gym.sh <scenario>` usage)
- Array results (`run-gym.sh --run-all` mode)
- Non-JSON input (silently skips — e.g., `--list` output)
- Empty input (silently skips)

### 2. Modified `test/gym/run-gym.sh`
Changed from `exec node` to capture-record-display pattern:
- `--list` mode: unchanged (`exec` for efficiency)
- Normal/run-all mode: 
  1. Run gym runner, capture JSON to temp file
  2. `cat` result to stdout (preserves original behavior)
  3. Pipe result through `record-result.ts` (best-effort, `|| true`)
  4. Exit with original exit code

### Opt-out
Set `GYM_NO_RECORD=1` to disable recording (falls back to `exec` behavior).

## Verification

Tested recording with:
- Single result → correctly inserted into `gym_runs` + `gym_checks`
- Array of results → correctly inserted both
- Duration parsing: "1m 30s" → 90000ms ✓
- Non-JSON input → silently skipped ✓
- Empty input → silently skipped ✓
- `--list` mode → unchanged behavior ✓

## Historical Data

The ~75 sessions' worth of gym results are lost (they were only in LLM session text, not structured). Going forward, all gym runs will auto-record.

## Files Modified

- `test/gym/run-gym.sh` — Added capture-record-display flow
- `test/gym/record-result.ts` — New: stdin JSON → DB recording script
