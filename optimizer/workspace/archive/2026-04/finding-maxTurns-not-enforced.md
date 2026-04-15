# Finding: maxTurns Not Enforced — Dead Variable in cron.ts

**Date**: 2026-04-01
**Severity**: HIGH (cost impact: ~$225/48h for Bob alone)
**Category**: Performance & Efficiency

## Summary

`handlerConfig.maxTurns` is configured in cron.json for heartbeat entries (e.g., Bob has `maxTurns: 30`) but the value is **computed and never passed to the session runner**. It's a dead variable.

## Evidence

### cron.ts line 705-706:
```typescript
const maxTurns = typeof entry.handlerConfig?.maxTurns === "number" ? entry.handlerConfig.maxTurns : undefined;
const sessionId = this.manager.run(agentName, taskMessage, {
  kind: "job",
  // ... maxTurns is NOT passed here
});
```

### RunOptions interface (manager-utils.ts):
Does NOT have a `maxTurns` field. The `opBudget` field was deprecated (always 0/unlimited).

### Impact (48h sample, 2026-03-31 to 2026-04-01):
- **Bob heartbeat**: 41 sessions, avg 53 turns (max 137), avg $5.49, total **$225.05**
  - Config says maxTurns: 30, but sessions routinely exceed this
  - Most expensive: 137 turns, $16.70, 5.4M input tokens
- **Optimizer heartbeat**: 41 sessions, avg cost $2.91, total $119.38
- **Coach heartbeat**: 23 sessions, avg $4.21, total $96.73
- Total heartbeat cost (48h, all agents): **$503.32**

### Bob's sessions exceed maxTurns consistently:
| Turns | Cost | Input Tokens |
|-------|------|-------------|
| 137 | $16.70 | 5.4M |
| 103 | $12.17 | 3.9M |
| 94 | $11.02 | 3.5M |
| 83 | $9.47 | — |
| 77 | $8.90 | 2.9M |

If maxTurns: 30 were enforced, cost per session would be ~$2-3 (based on the 30-turn sessions costing $2-3).

## Estimated Savings

If Bob's heartbeats were capped at 30 turns:
- Current avg: $5.49/session → Estimated avg at 30t: ~$2.50/session
- 48h savings: ~$123 (~55% of Bob's heartbeat cost)
- Monthly savings: ~$1,845

## Proposed Fix

### Option A: Add maxTurns to RunOptions + enforce in session loop
- Add `maxTurns?: number` to `RunOptions` interface
- In the session loop (manager.ts ~line 268), check `session.turnCount >= maxTurns` and gracefully terminate
- Pass from cron.ts: `this.manager.run(agentName, taskMessage, { maxTurns, ... })`

### Option B: Inject turn budget as a system message
- Add to the task message: "BUDGET: Complete within 30 turns."
- Less reliable but doesn't require code changes

### Recommendation: Option A
It's a clean ~10-line code change. Option B relies on LLM compliance which is unreliable.

## Files to Change
1. `src/lib/manager-utils.ts` — Add `maxTurns?: number` to RunOptions
2. `src/lib/manager.ts` — Add turn limit check in session loop (~line 268)
3. `src/app/cron.ts` — Pass maxTurns to `this.manager.run()` call (line 706)
