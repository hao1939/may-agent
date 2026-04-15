# Design Brief: Heartbeat Overtrigger Fix

**Author**: Optimizer  
**Date**: 2026-03-17  
**Priority**: P1 — $435/day waste  
**Severity**: HIGH — 160 extra sessions per 7.5 hours  

## Problem

Heartbeat agents are running at 2-3x their expected rate due to `agents.send()` triggering extra heartbeats.

| Agent | Expected/hr | Actual/hr | Ratio | Extra sessions/7.5h |
|-------|-------------|-----------|-------|---------------------|
| May | 6.0 | 16.7 | 2.79x | 80 |
| Tech-lead | 3.16 | 10.3 | 3.26x | 54 |
| Coach | 2.61 | 6.1 | 2.36x | 26 |
| **Total** | | | | **160** |

At $0.85/session avg, this wastes **~$136 per 7.5 hours ($435/day)**.

## Root Cause

Two mechanisms in `src/app/cron.ts` cause overtriggering:

### 1. Low trigger cooldown (60 seconds)

```typescript
// Line 58 in cron.ts
readonly triggerCooldownMs = 60_000;
```

When agent A calls `agents.send("tech-lead", "do X")`, the agents tool calls `triggerHeartbeat("tech-lead")` which calls `cron.triggerNow("heartbeat-tech-lead")`. The 60-second cooldown is far too short — tech-lead's heartbeat interval is 19 minutes, so any send after 60s triggers a new session.

### 2. Pending trigger latch bypass

```typescript
// checkPendingTrigger (line 384-391)
private checkPendingTrigger(entry: CronEntry): void {
    if (this.pendingTriggers.has(entry.name)) {
      this.pendingTriggers.delete(entry.name);
      // Fires immediately — NO cooldown check
      if (mode === "heartbeat") this.fireHeartbeat(entry);
      ...
    }
}
```

If a trigger arrives while the agent is busy, it gets latched. On completion, `checkPendingTrigger` fires immediately without any cooldown check. Combined with multiple agents sending work, this creates back-to-back sessions.

## Proposed Fix

### Fix 1: Increase trigger cooldown to half the cron interval

Instead of a flat 60s cooldown, use half the entry's interval:

```typescript
// Replace flat cooldown:
// readonly triggerCooldownMs = 60_000;

// With per-entry cooldown in triggerNow():
triggerNow(entryName: string, opts?: { force?: boolean }): boolean {
    const entry = this.entries.find((e) => e.name === entryName);
    if (!entry) return false;

    // Cooldown = half the entry's interval, minimum 60s
    const intervalMs = (entry.intervalMinutes ?? 10) * 60_000;
    const cooldownMs = Math.max(intervalMs / 2, 60_000);

    const lastTrigger = this.lastTriggerTime.get(entryName) ?? 0;
    if (!opts?.force && Date.now() - lastTrigger < cooldownMs) return false;
    // ... rest unchanged
}
```

This gives:
- May (10min): 5-minute cooldown
- Optimizer (11min): 5.5-minute cooldown
- Bob (17min): 8.5-minute cooldown
- Tech-lead (19min): 9.5-minute cooldown
- Coach (23min): 11.5-minute cooldown

### Fix 2: Make pending trigger respect cooldown

```typescript
private checkPendingTrigger(entry: CronEntry): void {
    if (this.pendingTriggers.has(entry.name)) {
      this.pendingTriggers.delete(entry.name);
      // Don't re-fire immediately — just ensure next scheduled fire happens
      // The work is already in the agent's todo.md and will be picked up
      // at the next scheduled interval
    }
}
```

Or alternatively, have checkPendingTrigger wait a short delay (e.g., 30 seconds) before re-firing, to allow multiple pending sends to coalesce.

## Impact

- Expected reduction: ~160 sessions/7.5h → ~20-30 sessions/7.5h extra (from natural variance)
- Cost savings: ~$350-400/day
- No functionality loss: work sent via `agents.send()` goes to todo.md and gets picked up at the next heartbeat
- The `agents.send()` still returns immediately — the todo is written regardless of trigger

## Files to Change

- `src/app/cron.ts` — lines 58, 164 (cooldown logic)
- `src/app/cron.ts` — lines 384-391 (`checkPendingTrigger`)

## Testing

- Existing cron tests should still pass
- Add test: verify triggerNow respects per-entry cooldown
- Add test: verify pending trigger doesn't bypass cooldown
- Manual verification: check session rates 1 hour after deploy

## Risks

- LOW: If an agent sends truly urgent work, it won't trigger immediate processing. But the todo.md mechanism ensures it gets processed at the next heartbeat interval (max wait: the cron interval).
- MITIGATION: Keep `force: true` option for retrigger mechanism (used by `checkRetrigger` which is already disabled via `maxRetriggers = 0`).
