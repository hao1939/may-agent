# BRIEF: Wire Dispatch Dedup Guard into Heartbeat Workflows

**Date**: 2025-05-06  
**Author**: bob  
**Status**: IMPLEMENTED  
**Parent**: EXP-860 (Zombie Task Circuit Breaker)  
**Priority**: P1 — structural fix, prevents recurring waste  
**Deployed**: 2025-05-08 — wired into `genericHeartbeat()` in heartbeat-data.ts

## Context

The dispatch dedup guard (`agents/shared/workflows/dispatch-dedup-guard.ts`) is **fully implemented** but **not wired in anywhere**. It was designed to prevent zombie task accumulation — where identical failing tasks are re-dispatched on every heartbeat indefinitely.

This is the most impactful unshipped structural fix in the system (per `ANALYSIS-intervention-futility-loop-2028-07.md`).

## Current State

- ✅ Module exists: `agents/shared/workflows/dispatch-dedup-guard.ts`
- ✅ API is clean: `shouldDispatch()`, `recordDispatch()`, `recordOutcome()`
- ✅ State file: `.state/dispatch-dedup.json` (no DB dependency)
- ❌ Not imported by any workflow
- ❌ No integration tests

## Integration Points

### Primary: `agents/shared/workflows/heartbeat-data.ts`

The main dispatch happens at line ~437:
```typescript
const result = await ctx.runAgent(agent, prompt);
```

This is the heartbeat session itself — it always runs. The dedup guard should wrap **work sessions dispatched FROM heartbeats** (via `agents.fork`), not the heartbeat itself.

However, since heartbeats dispatch work via `ctx.runAgent()` within the agent session (not in the workflow), the guard needs to be called by the **agent's context** or wired into a secondary dispatch point.

### Better Integration: Agent Fork Interceptor

The real zombie creation happens when agents call `agents.fork()` from within sessions. The guard should intercept at the infrastructure level:

1. In the `fork` tool handler, before creating a new session:
   ```typescript
   import { shouldDispatch, recordDispatch } from "../workflows/dispatch-dedup-guard.js";
   
   // Before forking:
   const check = shouldDispatch(targetAgent, task);
   if (!check.allowed) {
     return { error: `Dispatch blocked: ${check.reason}` };
   }
   recordDispatch(targetAgent, task);
   ```

2. On session completion, record outcome:
   ```typescript
   recordOutcome(agent, task, session.status);
   ```

### Minimum Viable Integration

If the fork interceptor is too invasive, a simpler approach:

Add to `genericHeartbeat()` before the `ctx.runAgent()` call:
```typescript
import { shouldDispatch, recordDispatch, recordOutcome as dedupOutcome } from "./dispatch-dedup-guard.js";

// Check if this agent's heartbeat has been failing repeatedly
const dedupCheck = shouldDispatch(agent, "heartbeat");
if (!dedupCheck.allowed) {
  ctx.emit({ type: "step_complete", step: "heartbeat", result: `Skipped: ${dedupCheck.reason}` });
  return ctx.done(`Heartbeat skipped for ${agent}: ${dedupCheck.reason}`);
}
recordDispatch(agent, "heartbeat");
```

Then after the result:
```typescript
dedupOutcome(agent, "heartbeat", result.status === "error" ? "error" : "success");
```

## Recommended Approach

**Option A (quick win)**: Wire into `genericHeartbeat()` to track heartbeat outcomes. This prevents the system from repeatedly running heartbeats for an agent that consistently errors.

**Option B (full fix)**: Add dedup check into the fork/call tool handler at the infrastructure level. This prevents ALL zombie dispatch patterns.

## What to Ship

1. Import the guard in `heartbeat-data.ts`
2. Wrap the `ctx.runAgent()` call with `shouldDispatch()` / `recordDispatch()` / `recordOutcome()`
3. Test with a manual dry run (inspect `.state/dispatch-dedup.json` after)
4. Monitor for 48h

## Expected Impact

- Prevents 9+ zombie sessions/day
- Saves $2-5/day in wasted tokens
- Makes `system_status` readable (no longer flooded with stale sessions)
- Demonstrates "structural fix > text rule" pattern working in practice
