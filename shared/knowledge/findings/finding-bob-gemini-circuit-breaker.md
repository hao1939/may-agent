# Finding: Bob 100% Failure Rate — No Circuit Breaker

**Date:** 2026-03-18T02:25 UTC
**Severity:** Medium (no cost waste, but zero Bob productivity)
**Status:** ✅ ALREADY IMPLEMENTED + TESTED (commit 50f05f4)

## Observation

Bob has had **14 consecutive Gemini API errors** from 23:46 to 02:20 UTC (2.5+ hours).
Only 1 successful session in that window. Error rate: **93%** (14/15 sessions).

All errors are identical:
```
litellm.ServiceUnavailableError: MidStreamFallbackError: APIConnectionError: 
OpenAIException - openai raised a streaming error - finish_reason: error
```

## Impact

- Bob has produced **zero useful work** for 2.5+ hours
- 14 wasted session setups (context injection, API attempts, session bookkeeping)
- Each error session takes 6-16s of infrastructure time
- With cron reload bug still active, Bob fires every ~540s instead of 1800s, amplifying waste

## Root Cause

**No circuit breaker for agent-level API failures.** The cron scheduler keeps firing Bob heartbeats regardless of consecutive errors. When Gemini is down, every session fails immediately but the system keeps retrying at the same rate.

## Proposed Fix: Agent Error Circuit Breaker

Add to cron scheduler (or SubagentManager):

1. Track consecutive error count per agent
2. After 3 consecutive errors: double the interval (exponential backoff)
3. After 5 consecutive errors: disable agent heartbeat temporarily
4. After 30 minutes: try one probe session
5. If probe succeeds: re-enable normal scheduling
6. If probe fails: wait another 30 minutes

This is a **JS handler** or cron scheduler enhancement — no LLM needed.

### Implementation Notes

- Track in memory: `Map<agentName, {consecutiveErrors: number, lastErrorTime: number}>`
- Check before scheduling: if `consecutiveErrors >= 5`, skip unless 30min since last attempt
- Reset on success
- File: `src/lib/manager.ts` (session scheduling) or `agents/may/handlers/` (new handler)

## Compound Effect with Other Bugs

This interacts with:
1. **Cron reload broken** (finding-cron-reload-broken.md) — Bob fires at 540s not 1800s
2. **Bob heartbeat template loop** (finding-bob-heartbeat-loop.md) — even when Bob succeeds, it loops on stale tasks

Fixing all three would: stop Gemini error waste + reduce Bob session rate 3.3x + make Bob sessions productive.

## Resolution (2026-03-18T02:42 UTC)

**Circuit breaker was already implemented in `src/app/cron.ts`:**

- `agentErrors` Map tracks consecutive errors per agent
- `CB_TRIP_THRESHOLD = 3` — trips after 3 consecutive errors
- `CB_PROBE_INTERVAL_MS = 30min` — allows one probe session after cooldown
- `recordAgentSuccess()` resets on success, `recordAgentError()` increments on failure
- Integrated into `fireHeartbeat()` .then/.catch callbacks
- Pre-flight check in `fire()` calls `isCircuitBroken(agentName)` before scheduling

**What was missing: test coverage.** Added 5 tests in commit `50f05f4`:
1. Heartbeat skipped after 3 consecutive errors
2. Probe allowed after 30-minute cooldown
3. Circuit resets on successful session
4. Independent circuit breakers per agent
5. TRIPPED log message at threshold

**Note on threshold difference:** Implementation uses threshold=3 (not 5 as proposed). This is more aggressive — trips faster, which is better for the observed pattern of sustained API outages. The 30-minute probe interval matches the proposal.

**Deployment note:** The circuit breaker is in-memory, so it requires a process restart to take effect. The current running process doesn't have it active yet (Bob's 14-error streak proves this). Next container restart will activate it.
