# Finding: Circuit Breaker Gap in Job-Handler Mode

**Date**: 2026-03-27T09:06
**Commit**: d3b04e9
**Impact**: Medium — prevents wasted sessions when agent models are down

## Problem

The existing circuit breaker (commit 97f3a50) only protects **heartbeat** cron entries. Agent-specific **job-handler** entries (like Bob's `analyze-failures`, `common-sense-infra`) bypass the circuit breaker entirely:

1. `isCircuitBroken()` check only in the `mode === "heartbeat"` branch of `fire()`
2. `recordAgentError()` / `recordAgentSuccess()` only called in `fireHeartbeat()`, not `fireHandler()`

Bob has 4 cron entries (heartbeat + 3 jobs). With the model `gemini-3-pro-preview` deprecated for 24+ hours, all Bob sessions fail — but only the heartbeat gets circuit-broken. The 3 job entries keep firing and failing.

## Fix

Two changes in `src/app/cron.ts`:

1. **Added circuit breaker check for all agent modes** — new block in `fire()` after the existing mode-specific checks:
   ```typescript
   if (mode !== "heartbeat" && entry.agent) {
     if (this.isCircuitBroken(entry.agent)) { ... return; }
   }
   ```

2. **Added error tracking to `fireHandler()`** — `recordAgentSuccess(agentName)` on `.then()` and `recordAgentError(agentName)` on `.catch()` for entries that have an `agent` field.

## Verification

- `tsc --noEmit` passes
- All 39 cron tests pass (including 5 existing circuit breaker tests)
- The existing circuit breaker logic (threshold=3, probe interval=30min) is reused — no new thresholds needed

## Estimated Savings

When active: prevents ~4-8 wasted job sessions per hour during agent model outages. At Bob's current failure rate (24h outage), saves ~100+ wasted sessions.

## Status

Code committed. Needs binary rebuild + process restart to activate.
