# Finding: May No-Op Heartbeat Waste Regression

**Date**: 2026-04-23
**Severity**: Medium
**Status**: Open

## Data

In the most recent 20 sessions:
- May: 9 sessions (45%)
- All other agents combined: 11 sessions (55%)

May's 9 sessions all had summaries like:
> "Heartbeat complete. Coder session still actively running Phase 7a+7h+7j..."
> "Heartbeat complete. 0 new items, 0 dispatchable."

**Zero deliverables from all 9 sessions.** Pure monitoring waste.

## Root Cause

The session-waste-reduction experiment (measured earlier today) showed improvement to 5.9%, but May has since regressed because:

1. May's heartbeat runs every 30 min (`intervalMs: 1800000`)
2. The `project` cron ALSO runs every 30 min for May
3. `eval-poller` and `context-learn-poller` also target May agent
4. When a coder session is actively running, May has nothing to dispatch but still does a full heartbeat analysis each time

The earlier fix addressed `hasRemainingWork()` re-trigger cascades, but the fixed-interval heartbeats still fire even when nothing has changed.

## Proposed Fix

**May heartbeat early-exit**: Add a check at the start of May's heartbeat:
- If no new items since last heartbeat AND no sessions completed since last check AND active sessions are still running → exit in <3 turns with "nothing changed" summary
- This is the H3 (No-Op Early Exit) from the session-waste-reduction experiment, which was proposed but not implemented

**Alternative**: Reduce May heartbeat to 60min when no active dispatches are pending, increase back to 30min when work is available.

## Impact

At ~45% of recent sessions, this is the single largest source of session waste. Each no-op May heartbeat consumes tokens for reading todo.md, checking sessions, and writing a "nothing to do" summary. Estimated 70%+ of May's token budget is wasted on these.
