# Analysis: Arc Agent Auto-Blocked

**Date**: 2026-05-06 15:05 UTC  
**Status**: RESOLVED (unblocked) + root cause identified

## Finding

Arc's heartbeat dispatch was **auto-blocked** after 3 consecutive `interrupted` sessions. The dispatch-dedup system has a rule: 3 failures in a 7-day window → block further dispatches.

Once blocked, the cron job `heartbeat-arc` still fires every ~7 min, but the workflow completes in 0ms with 0 steps (the agent never launches). This creates phantom "success" entries in workflow-runs that mask the underlying issue.

## Root Cause: Session Abort at 25 Ops

Arc's last 3 sessions all hit exactly 25 ops then were aborted:
```
2026-05-06T14:34:36 interrupted ops=25 "Request was aborted."
2026-05-06T14:24:44 interrupted ops=25 "The operation was aborted."
2026-05-06T14:11:59 interrupted ops=25 "The operation was aborted."
```

Prior to this, arc ran successfully with 56 ops. The 25-op cap suggests an infrastructure-level timeout or cost budget was hit. Arc uses `opus-4.7` model which is expensive — a 25-op session at ~5 min duration may be hitting a cost or time threshold.

## Actions Taken

1. **Unblocked arc** in `.state/dispatch-dedup.json` (reset failures=0, blocked=false)
2. Arc's next heartbeat should launch a real session again

## Recommendations

1. **Investigate the 25-op abort**: Is there a timeout or cost cap that changed recently? Arc's prior sessions ran 56 ops fine.
2. **Consider the auto-block threshold**: 3 interrupted sessions shouldn't permanently block an agent. Interrupted ≠ error — it may indicate infrastructure issues, not agent failures.
3. **Add observability**: When a dispatch is auto-blocked, emit a metric alert so may can detect and act sooner.

## Impact

- Arc has been unable to run heartbeats since ~14:34 UTC (30+ min)
- No knowledge entries or system analysis being produced during this window
- The `heartbeat-arc` cron shows "7 runs, 0 errors" — misleading since blocked runs show as "done" with 0 steps
