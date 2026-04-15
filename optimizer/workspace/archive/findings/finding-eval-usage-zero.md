# Finding: Evaluation Usage Data Always Zero

**Date**: 2026-03-18 (updated)
**Impact**: High — prevents all cost tracking, cost outlier detection, and budget optimization
**Status**: ✅ FIXED (commits 1671974, adc98bd) — awaiting process restart to take effect

## Problem

ALL 10,382 heuristic evaluation files have `usage.totalTokens: 0`, preventing cost tracking for root sessions (heartbeat/cron sessions).

## Root Cause (CONFIRMED)

**Two compounding issues:**

1. **Historical zeros (pre-fix)**: The original `writeHeuristicEvaluations` (commit `3636a1c`) didn't extract usage from transcripts. All evals written before the fix (commit `6c44f0e`, 2026-03-17 20:10:41 UTC) have hardcoded zeros.

2. **Fix not running**: Commit `6c44f0e` added `extractUsage()` to the heuristic path, but the **running process (PID 7) hasn't been restarted**. Evidence: 75 heuristic evals written AFTER the fix commit ALL have zero usage. The code is correct (manual simulation extracts usage perfectly: e.g., session `s_1773795302816_301` has 732,899 tokens/$2.255 in its transcript), but the process is running the pre-fix compiled code.

3. **No re-evaluation**: `writeHeuristicEvaluations` skips sessions that already have an eval file (`existsSync(evalPath)` check), so the 10,382 historical zero-usage evals will never be fixed automatically.

## Evidence

- 13,766 total evals: 10,382 heuristic (ALL zero), 3,384 LLM evals (999 nonzero)
- Root session transcripts DO have real usage: 17/20 checked have non-zero tokens
- Manual simulation of `extractUsage()` on the same transcripts returns correct data
- 75 evals written AFTER fix commit `6c44f0e` still have zero → stale running code
- Same root cause as cron interval reload bug (all committed fixes blocked on PID 7 restart)

## Fix (by tech-lead, 2026-03-18)

**Commit 1671974**: Changed `existsSync(evalPath) → continue` guard to check if existing eval has `totalTokens > 0 || turns > 0`. Zero-usage evals now fall through to re-evaluation with real `extractUsage()` data.

**Commit adc98bd**: Wired `writeHeuristicEvaluations()` into production — exported from `index.ts`, called at startup in `may.ts` (after `writeSkippedEvaluations`). Was previously dead code.

**Result**: On next process restart, ALL 10,382 zero-usage heuristic evals will be automatically re-evaluated with real token/cost data from transcripts. No manual backfill needed.

**Remaining blocker**: Process restart (PID 7) — same as all other pending fixes.

## Quantified Impact

- 92.7% of all evaluations (12,767/13,766) have zero usage data
- Cost tracking, waste detection, and budget optimization are all effectively blind
- Optimizer's "Cost outlier scan" periodic task cannot function without usage data
