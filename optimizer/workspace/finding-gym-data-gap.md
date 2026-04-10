# Finding: Gym Results Data Gap — 8 Days of Lost Data

**Date:** 2026-04-10
**Severity:** High — all gym measurement data lost since April 2
**Status:** Fixed

## Problem

Coach's `gym-helpers.ts` runs gym trials via `runGym()` but never recorded results to the `gym_runs` table in `may.db`. The `gym-record.ts` script exists but is only invoked by the shell pipeline (`gym-run-workflow.sh`). When coach switched to using `gym-helpers.ts` directly, the DB recording path was bypassed.

**Impact:** 75+ gym sessions in the last 8 days with 0 entries in `gym_runs`. Last recorded entry: April 2 (run ID 182). This means no regression tracking, no trend analysis, and no benchmark data for that entire period.

## Root Cause

`gym-helpers.ts` was designed as a pure execution helper — it runs the gym script, parses JSON output, and returns the result. The DB recording was a separate concern in `gym-record.ts`, connected only via the shell pipeline. When workflows started calling `runGym()` directly (from `growth-cycle.ts`, `training-sprint.ts`), the recording step was simply never included.

## Fix Applied

Added `recordGymResult()` function to `agents/coach/workflows/gym-helpers.ts`:

1. **`recordGymResult(result, opts?)`** — Standalone function that inserts into `gym_runs` and `gym_checks` tables. Schema matches `gym-record.ts` exactly. Wrapped in try/catch so DB failures never break gym execution. Returns the inserted run ID (or -1 on failure).

2. **Auto-recording in `runGym()`** — `runGym()` now calls `recordGymResult()` automatically after every run. Opt-out available via `opts.skipRecord: true`. Also accepts `batchId` and `runTag` for organized batch runs.

3. **Type alignment** — `GymResult` interface extended with optional fields (`duration_ms`, `session_id`, `cost_usd`, `total_ops`, `total_turns`, `method`, etc.) to match the full gym-record.ts schema. Check entries support both `message` (gym-helpers convention) and `detail` (gym-record convention).

## Verification

- Function compiles and imports correctly
- Test insertion: mock result inserted as run ID 183, with 2 checks, duration "2m 30s" correctly parsed to 150000ms
- Both `message` and `detail` fields on checks handled correctly
- Test data cleaned up after verification
- Existing `runGym()` callers unaffected — the new `opts` parameter is optional with no behavior change for `skipRecord: false` (default)

## Files Modified

- `agents/coach/workflows/gym-helpers.ts` — added `recordGymResult()`, `openGymDb()`, `parseDuration()`, updated `runGym()` signature and auto-recording

## Future Considerations

- The 75+ gym sessions from April 2-10 are permanently lost (no way to backfill)
- Consider adding a health check that alerts when `gym_runs` has no entries for >24h
- `gym-record.ts` CLI script is now redundant for coach workflows but still useful for shell-based ad-hoc runs
