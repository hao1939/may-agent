# DESIGN: Dispatch Deduplication Guard v2

**Author**: Bob | **Date**: 2025-05-01  
**Status**: IMPLEMENTED (Layer 3 code + tests complete)  
**Problem**: Agents (especially Bob) receive duplicate task dispatches, causing 10-50x wasted compute from interrupted sessions repeating the same work.

## Evidence

1. **Session dormancy audit** (2025-05-01): 50+ interrupted Bob sessions in 2 weeks, dominated by 3 repeating tasks: "Ship EXP-188" (~20x), "Resume context-learning" (~15x), "Process scout deep-dives" (~10x).
2. **Duplicate dispatch finding** (2025-06-22): 11 duplicate requests from human in 12 minutes for identical tasks.
3. **System-wide pattern**: May, evaluator, and coach also affected per `.state/findings/`.

## Root Causes

| Cause | Mechanism | Fix Level |
|---|---|---|
| Heartbeat re-dispatches stale tasks | HB sees unfinished work, forks again without checking if session exists | Agent-level |
| No idempotency in fork/call | `agents.fork()` accepts any task string with no dedup | Infrastructure |
| Interrupted sessions leave no "done" marker | Task stays in queue forever | Infrastructure |
| Project status not checked before dispatch | Closed project tasks keep re-triggering | Agent-level |

## Proposed Solution: Three-Layer Guard

### Layer 1: Fork-Level Dedup (Infrastructure)
```
Before creating a new session for agents.fork():
1. Hash the task string (first 200 chars + agent name)
2. Check if identical hash exists in sessions table within last 30 min
3. If match found AND status in (running, created): reject with "duplicate detected"
4. If match found AND status = interrupted: allow but log warning
```

**Already partially exists**: The `force` parameter on `agents.fork()` suggests dedup exists. But agents don't use it — they always get fresh dispatches from heartbeat logic.

### Layer 2: Heartbeat Task Registry (Agent-Level)
Each agent's heartbeat should maintain a simple registry:
```json
// .state/checkpoints/latest/{agent}.json → add "dispatched_tasks" field
{
  "dispatched_tasks": {
    "ship-exp-188": { "last_dispatch": "2025-04-28T10:00:00Z", "attempts": 20, "status": "stale" },
    "process-scout-dds": { "last_dispatch": "2025-04-30T12:00:00Z", "attempts": 10, "status": "stale" }
  }
}
```

**Rule**: If a task has been dispatched 3+ times without success, escalate to human instead of re-dispatching.

### Layer 3: Stale Task Reaper (Infrastructure)
A cron job that runs every 6 hours:
1. Query sessions where `status = interrupted` AND `age > 24h` AND `task` matches a known pattern
2. Mark the associated request as `stale`
3. If 5+ stale sessions for same task → auto-create an escalation

## Impact Estimate

- **Current waste**: ~50 interrupted sessions/2 weeks × ~$0.10/session = ~$5/2 weeks for bob alone
- **System-wide**: Multiply by ~5 agents affected = ~$25/2 weeks
- **With guard**: Reduce to <5 redundant sessions (90% reduction)

## Implementation Priority

1. **Layer 2 (agent-level)** — Can implement TODAY in heartbeat logic. Just track dispatch count and escalate after N failures.
2. **Layer 1 (infra)** — Needs tech-lead to wire into session creation. Medium effort.
3. **Layer 3 (reaper)** — Nice-to-have, can be a simple script initially.

## Hypothesis

**H-215**: Dispatch deduplication will reduce wasted bob sessions by >80% without blocking legitimate retries.

**Test**: Track bob interrupted session count per week before/after Layer 2 deployment. Baseline: ~25/week. Target: <5/week.

## Next Steps

- [ ] Implement Layer 2 in bob's heartbeat (track dispatched tasks in checkpoint)
- [ ] Propose Layer 1 to tech-lead as infrastructure improvement
- [ ] Set up simple measurement: count interrupted bob sessions per week
