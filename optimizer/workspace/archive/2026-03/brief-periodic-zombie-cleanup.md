# Brief: Periodic Zombie Session Cleanup

## Problem
`cleanupZombieSessions()` only runs at startup (src/app/may.ts:831). Between restarts, sessions stuck in "running" status accumulate indefinitely. Currently 30+ Bob zombies, 4 optimizer, 2 tech-lead.

## Root Cause
Sessions that crash, timeout, or are interrupted between restarts never get their status updated from "running" to a terminal state. The cleanup function exists and works, but only fires once at process startup.

## Proposed Fix
Add a periodic call to `cleanupZombieSessions()` — either:
1. **Option A (simplest)**: Add a cron handler that calls `manager.cleanupZombieSessions()` every hour
2. **Option B**: Call it at the end of every `SubagentManager.close()` (when any session ends)

Option A is preferred — it's non-invasive, self-contained, and matches the existing handler pattern.

### Implementation (Option A)
1. Create `agents/may/handlers/zombie-cleanup.ts`:
```ts
import { SubagentManager } from "../../src/lib/manager";

export default function register(manager: SubagentManager, bus: any) {
  bus.on("cron:zombie-cleanup", async () => {
    const archived = manager.cleanupZombieSessions();
    if (archived > 0) {
      bus.emit({ type: "info", message: `[zombie-cleanup] Archived ${archived} zombie session(s)` });
    }
  });
}
```
2. Add to cron.json: `{ "event": "cron:zombie-cleanup", "interval": "60m" }`

## Impact
- Prevents unbounded zombie accumulation
- No cost (JS-only, no LLM calls)
- Reduces session dir clutter between restarts

## Priority
P1 — Not urgent (restart will clean current batch), but prevents recurrence.
