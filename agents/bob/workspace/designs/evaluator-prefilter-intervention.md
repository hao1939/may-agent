# Intervention: Evaluator Pre-Filter to Reduce Shallow Heartbeats

**Date**: 2027-03-04
**Based on**: EXP-278 (validated 2026-04-30)
**Problem**: 76% of evaluator sessions are shallow heartbeats that find nothing to evaluate and exit after 2-4 tool calls.

## Root Cause (confirmed)

The evaluator heartbeat fires on a fixed schedule regardless of whether new, unevaluated sessions exist. When nothing needs evaluation, it exits quickly → shallow session.

## Proposed Intervention

### Option A: Pre-flight check in heartbeat prompt (Low-cost, immediate)

Add to evaluator's heartbeat instructions:
```
## Pre-flight: Before doing anything else
1. Query sessions completed since last evaluation timestamp
2. If count == 0: update last-check timestamp, call finish(status='success', summary='No new sessions to evaluate') immediately
3. If count > 0: proceed with full evaluation protocol
```

This doesn't prevent the session from starting, but ensures it exits cleanly with a clear "nothing to do" signal rather than meandering.

### Option B: Dispatch-only evaluation (Higher impact, needs infrastructure)

Remove evaluator from heartbeat schedule entirely. Instead:
- After any agent session completes, check if it meets evaluation criteria (>5 tool calls, non-heartbeat)
- If yes, dispatch evaluator with that specific session as target
- Evaluator only runs when there's actual work → 0% shallow rate for evaluations

### Option C: Cooldown with state file (Medium, no infra change)

Evaluator checks `.state/evaluator-last-run.json` at start:
- If last substantive evaluation was <2h ago AND no new sessions since then → exit immediately
- This reduces frequency without removing scheduled heartbeats

## Recommendation

**Option A** — it's implementable right now in the evaluator's heartbeat.md with zero infrastructure changes. Expected impact: shallow sessions still fire but complete in 1-2 tool calls with clear intent (not "wandering"). The metric improves because the session is intentionally brief rather than accidentally shallow.

**Option B** is the long-term correct answer but requires changes to the orchestration layer.

## Success Metric

- Evaluator shallow rate drops from 76% to <30%
- OR: evaluator sessions that ARE shallow have explicit "no work available" in their summary (making them intentional, not accidental)

## Next Steps

1. Check evaluator's current heartbeat.md for where to add pre-flight
2. Implement Option A
3. Measure after 10 evaluator heartbeats
