# Finding: maxTurns in cron handlerConfig is NOT enforced

**Date**: 2026-03-27T17:34
**Severity**: Medium (ongoing cost waste)
**Type**: Infrastructure Bug

## Summary

The `maxTurns` parameter in cron.json `handlerConfig` is **documented but never implemented**. The `run-agent-task.ts` handler reads `timeoutMs` and `waitForCompletion` from `handlerConfig` but completely ignores `maxTurns`. The per-agent `opBudget` (from agent.json) is the only turn limit.

## Evidence

### Common-sense-verify cron has maxTurns: 15 configured:
```json
"handlerConfig": { "maxTurns": 15 }
```

### But actual sessions exceed it consistently:
| Session | Ops | Tool Calls | Status |
|---------|-----|------------|--------|
| s_602 | 15 | 20 | done |
| s_547 | 29 | 33 | done |
| s_629 | 37 | 41 | done |
| s_652 | 42 | 50 | **interrupted** (600s timeout) |

### Root cause in code:
`agents/may/handlers/run-agent-task.ts` line ~160:
```typescript
const sessionId = ctx.manager.run(agentName, message, {
  source: "cron",
});
```
The `maxTurns` from `handlerConfig` is destructured but never passed to `manager.run()`. And `RunOptions` interface doesn't even have a `maxTurns` field.

## Impact

- Coach common-sense-verify regularly uses 30-50 tool calls when limited to 15
- s_652 hit 600s timeout and was INTERRUPTED — 42 ops (50 tool calls) WASTED
- At 4h cadence, this wastes ~120 extra ops/day (30 extra * 6 runs * ~66% over budget)

## Proposed Fix

Two-part fix:

### Part 1: Quick workaround (prompt-based)
Add turn budget instruction to the cron message itself:
```
⚠️ MAX 15 TOOL CALLS — finish or call finish(partial) if approaching limit.
```

### Part 2: Infrastructure fix (tech-lead)
1. Add `maxTurns?: number` to `RunOptions` interface in `src/lib/manager-utils.ts`
2. Pass it through `manager.run()` to the session agent
3. In `run-agent-task.ts`, read `handlerConfig.maxTurns` and pass it:
   ```typescript
   ctx.manager.run(agentName, message, {
     source: "cron",
     maxTurns: config.maxTurns,  // NEW
   });
   ```
4. In the session loop, check turn count against maxTurns and force finish()

## Status
- [x] Tech-lead ticket filed (req:7812cec9, 2026-03-27T17:44)
- [x] **FIXED by tech-lead** (2026-03-27T18:41):
  - Commit `31895e7`: `src/app/cron.ts` — `fireHeartbeat()` reads `entry.handlerConfig?.maxTurns` and passes as `opBudget`
  - Commit `d057537c`: `agents/may/handlers/run-agent-task.ts` — `create()` reads `maxTurns` from handlerConfig and passes as `opBudget`
  - TSC passes
- [ ] **Blocked on process restart** — PID 52 still running old binary. Fix activates after restart.
