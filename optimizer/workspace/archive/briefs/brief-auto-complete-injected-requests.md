# Brief: Auto-Complete Injected Send Requests After Heartbeat

## Problem

`agents.send()` creates a request with status CREATED. This request is injected into the target agent's heartbeat as a "pending task." However, after the heartbeat completes successfully, the request **stays CREATED forever**. The only way it gets marked COMPLETED is if the agent explicitly calls `finish({ completed_items: ["description matching the request"] })`, which requires fuzzy text matching and agents almost never do.

**Result:** 17 permanently stuck CREATED requests right now, all being re-injected into every heartbeat. The request DB becomes unreliable — you can't tell what's actually pending vs. already seen.

## Evidence

- 17 CREATED `send()` requests currently stuck (ages 3-40 minutes)
- 0 `send()` requests have ever been marked COMPLETED via `finish({ completed_items })` — only cron heartbeat requests get COMPLETED
- Previous manual cleanup expired 15 requests, but new ones keep accumulating
- `audit-requests.ts` handler has a 4-hour stale threshold — too generous for heartbeat-injected requests

## Root Cause

In `src/app/cron.ts` `fireHeartbeat()`:
- Line 388-401: Queries CREATED/IN_PROGRESS `send()` requests and injects them into the heartbeat message
- Line 427-431: Only marks the **cron heartbeat request itself** as COMPLETED
- No code marks the **injected requests** as COMPLETED

## Proposed Fix

In `src/app/cron.ts` `fireHeartbeat()`:

1. **Before** running the session, capture the injected request IDs:
```typescript
// After line 401 (the pending.map block), add:
const injectedRequestIds = pending.map(r => r.requestId);
```

2. **After** the session completes successfully (inside the `.then()` callback on ~line 426), auto-complete them:
```typescript
// After line 431 (the existing updateRequest for the heartbeat itself), add:
// Auto-complete injected send() requests that were shown to this agent
if (injectedRequestIds.length > 0) {
  for (const reqId of injectedRequestIds) {
    try {
      updateRequest(this.persistDir, reqId, {
        status: "COMPLETED",
        completedAt: Date.now(),
        summary: `Auto-completed: injected into ${agentName} heartbeat session ${sessionId}`,
      });
    } catch { /* best-effort */ }
  }
}
```

## Why This Is Safe

- The agent SAW the request (it was in the heartbeat prompt)
- The session completed successfully (status "done" / no error)
- If the agent needed to act on it, they had the chance
- If the request needed follow-up, the agent should have created a new request via `finish({ new_items })`
- This matches the behavior of FYI/informational messages: read once, then done

## Edge Cases

- **Session errors**: The `.catch()` branch should NOT auto-complete injected requests — the agent may not have processed them
- **Partially processed**: If an agent processes 3 of 5 injected requests before hitting opBudget (error), none should be auto-completed. This is correct since the error path doesn't auto-complete.
- **Long-running work**: If a `send()` request requires multi-session work, the agent should use `finish({ new_items: ["continue work X"] })` to create a new self-assigned request. The original CREATED request should still be marked done because the agent acknowledged it.

## Scope

- **File**: `src/app/cron.ts`, `fireHeartbeat()` method
- **Lines changed**: ~10 lines added
- **Risk**: Low — only affects completed heartbeat sessions
- **Tests**: Add test verifying injected requests are auto-completed after successful heartbeat
