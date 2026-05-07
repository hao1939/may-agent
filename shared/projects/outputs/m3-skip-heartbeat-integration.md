# M3: Integrate `shouldSkipHeartbeat()` into `genericHeartbeat()`

## Change Summary
Integrated the previously-dead `shouldSkipHeartbeat()` function into the `genericHeartbeat()` flow in `agents/shared/workflows/heartbeat-data.ts`.

## What was done
- Added 8 lines after `const inbox = loadInbox(ctx, agent);` (line 384) and before the circuit breaker check
- The skip check runs after all data is loaded (metrics, alerts, inbox, projects) but before any expensive processing
- If skip reason is returned, emits a `heartbeat_skipped` event, logs, and returns early via `ctx.done()`

## File modified
- `agents/shared/workflows/heartbeat-data.ts` — lines 386-392
