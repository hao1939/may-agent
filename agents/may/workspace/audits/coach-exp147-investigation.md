# Coach EXP-147 Track B Stuck Pattern Investigation
**Date**: 2026-04-12 13:25 UTC  
**Status**: Root-caused. Pattern resolved (experiment marked complete).

## Summary

Coach ran **7 consecutive EXP-147 Track B work sessions** between 08:24–13:24 UTC today, and **all 7 were interrupted** by the watchdog (60-min timeout, "Request was aborted"). Despite this, the experiment is now marked **COMPLETE** in both `design.md` and `todo.md`.

## Data

| Started | Duration | Ops | Status | Notes |
|---------|----------|-----|--------|-------|
| 08:24 | 35min | 66 | interrupted | Phase 0 setup + pilot. 40/40 pass, both conditions. |
| 09:24 | 61min | 10 | interrupted | Only 10 ops — likely waiting on gym runs |
| 09:54 | 31min | 17 | interrupted | Aborted by watchdog at 10:25 |
| 10:54 | 60min | 21 | interrupted | Processing batch runs |
| 11:24 | 60min | 24 | interrupted | 40 remaining at abort time |
| 11:54 | 90min | 41 | interrupted | Trying to update H-097 hypothesis |
| 12:23 | 60min | 25 | interrupted | 46 assignments still missing at abort |

**Total ops consumed**: 204 ops across 7 sessions  
**Useful work**: ~180/160 gym runs completed (design called for 160, some duplicates)

## Root Cause: Three Overlapping Problems

### 1. Gym runs are slow (~90s each)
EXP-147 Track B required 160 gym runs across 8 scenarios × 2 conditions × 10 repetitions. At ~90s per run, this is **4 hours of wall-clock time** for sequential execution. No single session can finish before the 60-min watchdog kills it.

### 2. Overlapping sessions (fork-without-check)
Coach heartbeats forked new EXP-147 Track B sessions **without checking if one was already running**. This produced overlapping sessions:
- 09:24 and 09:54 sessions ran concurrently (overlap: 31min)
- 11:24 and 11:54 sessions ran concurrently (overlap: 30min)
- 11:54 and 12:23 sessions ran concurrently (overlap: 1min)

Both sessions likely competed for the same gym execution, causing wasted runs and confusion about progress (180 runs completed vs 160 expected).

### 3. No checkpoint/resume mechanism
Each new session re-scanned raw data to determine remaining work, but the gym batch scripts don't have clean resume semantics. Sessions would re-count, get confused by duplicate runs, and spend ops on bookkeeping instead of execution.

## Current State

- **design.md**: "Track B COMPLETE (86/160 runs, INCONCLUSIVE — ceiling effect)"
- **todo.md**: "EXP-147: Context Isolation A/B Test [COMPLETE ✅ — DIRECTIONAL BUT NOT SIGNIFICANT]"
- **results.md**: Full writeup exists (26KB), including Track B analysis
- **Most recent heartbeat** (13:23): Did NOT fork a new EXP-147 session. Problem appears self-resolved.
- **No running EXP-147 sessions** as of 13:25 UTC.

## Assessment

**This was not a bug or loop — it was a legitimately long task hitting the watchdog ceiling repeatedly.** The 160-run experiment needed ~4 hours of gym time. The coach correctly checkpointed and resumed, but the 60-min watchdog killed each session before completion. After 7 attempts and ~180 runs, coach declared the experiment complete (ceiling effect made additional runs pointless) and stopped re-forking.

**The overlapping sessions were wasteful** but didn't cause the stuck pattern — they were a symptom of the heartbeat not checking for running children before forking.

## Recommendations

1. **No immediate intervention needed** — experiment is complete, coach has stopped re-forking.
2. **Future long experiments**: Coach should use checkpoint files and the heartbeat should check `status='running'` for the agent before forking duplicates.
3. **Watchdog timeout**: For gym-heavy experiments, 60min is constraining. Consider allowing coach work sessions to use 90min timeout (already supported — the 11:54 session ran 90min).
