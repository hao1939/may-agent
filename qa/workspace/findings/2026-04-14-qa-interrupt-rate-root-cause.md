# QA 58% Interrupt Rate — Root Cause Analysis

**Date**: 2026-04-14
**Investigator**: May (session s_1776169082223_80)
**Status**: FIX DEPLOYED

## Summary

QA heartbeat sessions experienced a 53% interrupt rate (8/15 recent sessions) starting 2026-04-14T05:51Z. Root cause: **interaction between EXP-TIERED-BUDGET turn limits and the FM-3.3 finish-guard redirect**. The fix extends the hard limit when guard redirects occur.

## Root Cause

### The Interaction

Two systems collided:

1. **EXP-TIERED-BUDGET** (merged 2026-04-13T12:22Z): Imposes soft turn budget of 8 turns for heartbeat sessions, with a 2-turn grace period (hard limit = 10).

2. **FM-3.3 finish-guard** (pre-existing): When an agent calls `finish(status: "success")` with deliverables, the guard verifies those files actually exist. If verification fails, the guard **blocks** the finish and **redirects** the agent to run a verify-wrap workflow.

### The Race Condition

| Turn | Done Session (finishes early) | Interrupted Session (finishes late) |
|------|-------------------------------|-------------------------------------|
| 7 | Calls `finish()` → blocked by guard → redirect | Still doing work |
| 8 | Runs verify-wrap workflow | Calls `finish()` → **budget warning injected** |
| 9 | Re-calls `finish()` → succeeds → **done** | Guard blocks → redirect injected |
| 10 | — | Runs verify-wrap (hard limit imminent) |
| 11 | — | Re-calls `finish()` → **ABORTED mid-stream** |

When QA calls `finish()` at turn 7 (before the budget warning), the redirect cycle completes within the grace window. When QA calls `finish()` at turn 8+ (after the budget warning), the redirect cycle pushes the session past the hard limit, and the abort controller fires mid-stream: `"Request was aborted."`.

### Evidence

- **Every QA session** since EXP-TIERED-BUDGET has exactly 11 assistant turns and receives the budget warning
- **Done sessions**: first `finish()` at turn 7-8 (before or at budget warning) 
- **Interrupted sessions**: first `finish()` at turn 9-10 (after budget warning, during grace period)
- **Pre-budget sessions**: 16 turns, no interruptions (e.g., s_1776144098393_613)
- **Other agents**: tech-lead has 10% interrupt rate (27.6 avg ops — bigger sessions, less likely to hit boundary)

## Fix Applied

**3 files changed** — targeted fix that extends the hard limit when guard redirects occur:

### 1. `src/lib/manager-utils.ts` — Added `guardRedirectCount` to `ActiveSession`
```typescript
guardRedirectCount: number;  // Initialized to 0
```

### 2. `src/lib/manager-receipts.ts` — Increment counter on guard redirect
```typescript
if (guardResult.redirect) {
  redirectSession.guardRedirectCount++;
  // ... existing steer() code
}
```

### 3. `src/lib/manager.ts` — Extend hard limit based on redirect count
```typescript
const guardExtension = session.guardRedirectCount * TURN_BUDGET_GRACE;
const hardLimit = softLimit + TURN_BUDGET_GRACE + guardExtension;
```

### Effect

- **Without guard redirect**: hardLimit = softLimit + 2 (unchanged behavior)
- **With 1 guard redirect**: hardLimit = softLimit + 2 + 2 = softLimit + 4
- **With 2 guard redirects**: hardLimit = softLimit + 2 + 4 = softLimit + 6

This gives the agent exactly enough room to complete the verify-then-re-finish cycle that the guard system requires.

## Verification

- TypeScript compiles cleanly (`tsc --noEmit` — 0 errors)
- All 55 turn-budget tests pass
- All 74 workflow-guards tests pass
- All 72 manager-infra-retry tests pass

## Why Not Other Root Causes?

| Hypothesis | Ruled Out By |
|------------|-------------|
| Watchdog killing sessions | Watchdog timeout is 60-90 min; QA sessions are 38-64 seconds |
| API rate limiting | ApiGate has 8 concurrent limit; QA isn't saturating it |
| Server restart | Sessions continued running normally for other agents |
| Active-nudge | Only fires after 5 min of stalling; QA sessions are <90s |
| Turn budget alone | Both done AND interrupted sessions have 11 turns — the budget itself isn't the problem |
