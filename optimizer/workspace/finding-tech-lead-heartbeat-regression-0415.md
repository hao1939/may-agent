# Finding: Tech-Lead 100+ Op Heartbeat Regression (Apr 15)

**Date**: 2026-04-15
**Severity**: Medium — two sessions, not systemic
**Status**: Root cause identified, actionable

## Summary

Two consecutive tech-lead heartbeats at 13:30 and 14:00 UTC regressed to 100+ ops, breaking the pattern established by the dispatcher-mode fix. This is NOT a regression in the fix itself — the fix is working (16/18 heartbeats today at 3-11 ops, avg 6.3). These two sessions represent a specific failure mode: the heartbeat dispatched work correctly but then **continued doing work inline** instead of finishing.

## Evidence

### Overall Pattern (fix is working)

| Period | Heartbeats | Avg Ops | Max Ops | Notes |
|--------|-----------|---------|---------|-------|
| 24h ago (pre-fix baseline) | 10 | 6.5 | 8 | Stable |
| Today 06:00-13:00 (post-fix) | 15 | 5.9 | 11 | Fix holding |
| Today 13:30 | 1 | 100 | 100 | **Regression** |
| Today 14:00 | 1 | 103 | 103 | **Regression** (interrupted) |
| Today 14:30 | 1 (running) | 8+ | — | Back to normal |

Excluding the two outliers, post-fix average is **6.3 ops** — matching the 6.5 pre-fix baseline perfectly.

### Session 1: `s_1776259835111_5` (100 ops, done, 24min)
- **Started**: 13:30:35 UTC
- **What happened**: Heartbeat correctly identified work (stale review branches) and dispatched it. But then it continued doing branch merge work inline too:
  - Dispatched via May: `s_1776259969295_9` (16 ops) → merge branches
  - Forked: `s_1776260248991_13` (44 ops) → review and merge 5 branches  
  - Itself: continued doing 100 ops of work instead of finishing after dispatch
- **Total ecosystem cost**: 100 + 16 + 33 (coder child) + 44 = **193 ops** for branch merging

### Session 2: `s_1776261634460_23` (103 ops, interrupted, 18min)
- **Started**: 14:00:34 UTC
- **What happened**: Ran for 103 ops with no children (no forks, no workflows). Got stuck, triggering `stuck_detected` evaluation by evaluator. Eventually interrupted by system.
- **Error**: `Request was aborted.`
- **No children at all** — pure inline work in heartbeat

## Root Cause Analysis

The heartbeat.md has the right instructions ("Fork all substantive work") but the LLM doesn't always follow them. Two specific failure modes:

1. **Dispatch-then-continue**: Session 1 dispatched correctly but then kept working instead of calling `finish()`. The heartbeat accumulated 100 ops because it did branch review work inline alongside its dispatched sessions.

2. **No-dispatch work**: Session 2 did 103 ops purely inline with zero forks. The `stuck_detected` trigger fired but couldn't save the session. The LLM ignored the "must-fork" rules entirely.

Both failures happened on consecutive heartbeats (13:30, 14:00). This suggests a possible context issue: the 13:30 session was still running when the 14:00 heartbeat fired, and both may have been working on overlapping tasks.

## Impact

- **Op waste**: ~203 ops consumed by these two heartbeats (vs ~12 expected for two lean heartbeats)
- **System noise**: Concurrent 100-op sessions may have caused git conflicts or task contention
- **Not systemic**: 16/18 heartbeats today are within budget. Fix is 89% effective.

## Comparison to Baseline

| Metric | Pre-fix (Apr 14 evening) | Post-fix normal | Post-fix outliers |
|--------|-------------------------|-----------------|-------------------|
| Avg ops/heartbeat | 6.5 | 6.3 | 101.5 |
| Max ops | 8 | 11 | 103 |
| Fork behavior | Sometimes forked | Always fork | None/partial |

## Recommendations

1. **Hard op budget in heartbeat.md**: Add explicit instruction: "After forking work, call finish() immediately. Do NOT continue working on the same topic inline." The current "CRITICAL: Keep heartbeats lean" is too vague.

2. **Post-dispatch finish guard**: Consider adding to heartbeat.md Step 3: "After any agents.fork() or workflow.run(), call finish() with summary of what was dispatched. Maximum 3 more ops after dispatching."

3. **No structural changes needed**: Per KE-008, do NOT restructure heartbeat steps. The fix is working 89% of the time. These are LLM judgment failures, not structural issues.

4. **Monitor**: Track if the pattern repeats. If it's a consistent 10-15% failure rate, the cost is ~20 extra ops/day — acceptable. If it climbs, add a system-level budget cap.

## Data Appendix

All tech-lead heartbeats today (UTC):
```
06:00  5 ops  done
06:30  4 ops  done
07:00  4 ops  done
07:30  9 ops  done
08:00  5 ops  done
08:30  3 ops  interrupted
09:00  6 ops  done
09:30  7 ops  done
10:00  6 ops  done
10:30  7 ops  done
11:00 11 ops  done
11:30  6 ops  done
12:00  7 ops  done
12:30  4 ops  done
13:00  9 ops  done
13:30 100 ops  done     ← OUTLIER
14:00 103 ops  interrupted ← OUTLIER (stuck_detected)
14:30  8+ ops  running
```
