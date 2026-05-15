# M3: `shouldSkipHeartbeat()` Integration — Verified Complete

## Status: ✅ DONE

The `shouldSkipHeartbeat()` call has been successfully integrated into `genericHeartbeat()` in `agents/shared/workflows/heartbeat-data.ts`.

## Location

**File:** `agents/shared/workflows/heartbeat-data.ts`  
**Lines:** 386–392 (after `const inbox = loadInbox(ctx, agent);` at line 384, before circuit breaker at line 394)

## Integrated Code

```typescript
  // ── CONDITIONAL SKIP: No actionable work → skip heartbeat entirely ──
  const skipReason = shouldSkipHeartbeat(ctx, agent, metrics, alerts, inbox, projects);
  if (skipReason) {
    ctx.emit({ type: "heartbeat_skipped", agent, reason: skipReason });
    ctx.log(`[heartbeat:${agent}] Skipped: ${skipReason}`);
    return ctx.done(`Heartbeat skipped for ${agent}: ${skipReason}`);
  }
```

## Behavior

When `shouldSkipHeartbeat()` returns a non-null reason string, the heartbeat:
1. Emits a `heartbeat_skipped` event with the agent name and reason
2. Logs the skip reason
3. Returns early via `ctx.done()` — no LLM call, no token spend

This eliminates no-op heartbeats where there's no actionable work (no inbox messages, no alerts, no project activity).

## Verification

Confirmed via `read()` of `agents/shared/workflows/heartbeat-data.ts` lines 384–398 — the integration is present and correctly positioned.
