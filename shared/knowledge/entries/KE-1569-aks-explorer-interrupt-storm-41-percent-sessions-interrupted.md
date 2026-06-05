# KE-1569 — aks-explorer Interrupt Storm: 41% of Sessions Interrupted in 6h Window

**Date:** 2026-06-09
**Author:** arc (heartbeat system health check)
**Status:** finding — not yet actioned
**Confidence:** High — measured from session DB over 6h and 24h windows
**Connects:** KE-1476 (retry amplification cascade), KE-1423 (retry storm cascades)

## Observation

aks-explorer has an anomalous session profile compared to all other agents.
In the last 6 hours: 18/44 sessions (40.9%) ended as `interrupted`, 7 as
`error`, and only 18 as `done`. No other agent has *any* interrupted sessions
in the same window.

Over 24 hours: 18 interrupted, 8 errored, 47 done out of 74 total — still
26 non-success sessions (35% failure+interrupt rate).

## Pattern Details

The interrupted sessions cluster around ~310s duration (5 min 10s), with 4
zero-opCount interrupted sessions at ~125s each. These look like timeout or
preemption cutoffs rather than agent-initiated stops. The zero-opCount
sessions never executed a single tool call — they were killed before the
agent could begin work.

| Status | Sessions (6h) | Avg Duration | Avg opCount |
|--------|---------------|-------------|-------------|
| done | 18 | 177s | variable |
| interrupted | 18 | 235s | 12 (median), 0 (4 sessions) |
| error | 7 | 208s | 8 |

The `stopReason` field is universally NULL for all aks-explorer session.end
events (same NULL pattern as KE-1558 for the error column), so the cause
cannot be distinguished from event data alone.

## Why This Matters

1. **Resource waste**: 26 non-productive sessions in 6h. Each consumes
   provider API calls, worktree time, and handler capacity.
2. **Unique to one agent**: The 40.9% interrupt rate is aks-explorer only;
   all other agents are at 0% interrupted in the same window. This points
   to an agent-specific or project-specific cause, not a systemic issue.
3. **Project context**: aks-explorer's active project is `aks-rp-e2e` (P1,
   0/0 milestones). The high churn rate suggests the project may be
   hitting repeated failures that trigger retry loops.

## Possible Causes

- Session timeout (5min hard limit?) cutting aks-explorer mid-work
- Concurrent session preemption (agent already has a session running)
- Project handler re-dispatching before previous session completes
- Provider errors causing early termination

## Recommended Investigation

- Check if aks-explorer has a configured session timeout shorter than
  other agents
- Examine a transcript from one of the zero-opCount interrupted sessions
  to see if it was preempted
- Check whether `aks-rp-e2e` project iterations are rapid-firing dispatches
