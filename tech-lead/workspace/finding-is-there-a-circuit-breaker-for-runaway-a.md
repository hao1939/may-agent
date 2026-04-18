# Finding: Is There a Circuit Breaker for Runaway Agent Sessions?

**Lens**: D (Fragility)  
**Date**: 2026-04-18  
**Severity**: Medium

## Summary

The system has two circuit-breaker mechanisms but **no max-ops guard**. A session making successful (non-error) tool calls can accumulate unlimited ops. The stuck detector only fires on *consecutive error turns*, so a session that keeps succeeding but never converges (e.g., coach's 65-op session) is invisible to it.

## Evidence

### 1. Stuck Detector (error-turn based)
- `session-subscribers.ts:141-142`: `STUCK_WARNING_THRESHOLD = 4`, `STUCK_TERMINATE_THRESHOLD = 6` — triggers only on **consecutive error turns**.
- `session-subscribers.ts:186`: Warning injected when `consecutiveErrorTurns >= 4`.
- `session-subscribers.ts:203-228`: At 6 consecutive errors, evaluates whether to kill. On kill, emits cancel event and notifies May via circuit-breaker (`may.ts:207-214`).
- **Gap**: A session making 100 successful ops never triggers this. The stuck detector is blind to non-error runaway loops.

### 2. Timeout (wall-clock based)
- `may.ts:120-127`: `ONESHOT_TIMEOUT_MINUTES` defaults to 5 minutes (configurable via `--timeout=`).
- `manager.ts:710-727`: `setupTimeout()` sets a timer that kills the session after `timeoutMs`.
- `manager.ts:1054`: Applied to new sessions via `def.timeoutMs` from agent definitions.
- **Coverage**: This does cap wall-clock time. But 65 ops in 5 minutes is plausible with fast LLM responses — the timeout may not catch high-op sessions.

### 3. No Max-Ops Limit
- `manager.ts:1007-1008`: `opBudget: 0, opCount: 0` — `opBudget` is tracked but per context note, opBudget enforcement was **removed** ("opBudget removed — do not implement tool call limits").
- `manager.ts:2273`: `getOpUsage()` returns opBudget/opCount but it's informational only.
- There is no code path that terminates a session when opCount exceeds a threshold.

## Diagnosis

The stuck detector handles crash-loops (repeated errors). The timeout handles hung sessions. But neither addresses the "productive but non-converging" case — an agent that keeps reading files, querying DBs, and making progress without reaching a conclusion. Coach's 65-op and 51-op sessions are examples of this pattern.

## Recommended Action

**No immediate fix needed** — the 5-minute timeout provides a hard wall-clock cap, and the policy decision to remove opBudget was intentional. However, consider:
1. **Monitoring**: Alert when any session exceeds 40 ops (informational, not killing).
2. **Soft nudge**: Inject a system message at ~30 ops reminding the agent to wrap up, similar to the stuck-warning pattern at `session-subscribers.ts:186`.
