# Audit: manager-retry.ts Fragility Analysis

**File**: `src/lib/manager-retry.ts` (431 lines)
**Lens**: D — Fragility  
**Date**: 2026-04-14  
**Auditor**: Scout

---

## Summary

The retry system is well-structured with clear separation of concerns: `isRetryableInfraError()` detects transient failures, `runAgentWithRetry()` orchestrates the retry loop. The main retry loop (while loop) has a hard bound via `infraRetryMax` (default 5) and is safe against infinite loops. However, a **recursive call** in the post-loop catch creates a subtle fragility: it can multiply the effective retry count beyond the configured maximum, and it drops the `persistDir` parameter, silently disabling digest logging on recursive retries. There are also state-mutation patterns during the delay window that could interact poorly with concurrent session operations.

---

## Findings

### 1. [MEDIUM] Recursive tail call multiplies effective retry count beyond configured max

**Location**: Lines 419–425 (post-loop empty-response catch)

The post-loop catch at L379–427 triggers **after** the main while-loop exits, incrementing `infraRetryCount` once more, then recursively calling `runAgentWithRetry()`. The recursive call passes the same `infraRetryMax`, but `session.infraRetryCount` only incremented by 1 for the post-loop attempt. If the recursive call enters its own while-loop and hits the post-loop catch again, the recursion can chain:

- Main loop: up to `infraRetryMax` retries (5)
- Post-loop catch: +1 retry, then recurse
- Recursive main loop: up to `infraRetryMax - count` retries
- Recursive post-loop: +1 retry, then recurse again

In practice, the total retries are still bounded by `infraRetryMax` because `session.infraRetryCount` accumulates across recursions. But the recursion depth is **not bounded** — if each recursive invocation increments count by 1 (via post-loop) and then recurses, you get up to `infraRetryMax` levels of recursion. With default 5, this is harmless. But if someone bumps `infraRetryMax` to a large value, the recursion depth grows linearly.

**More critically**, the exit condition is fragile: the post-loop check `session.infraRetryCount < infraRetryMax` could allow entry even when the main loop used all retries, if there's an off-by-one. Currently this doesn't happen because the while-loop is `<` not `<=`, but it's a maintenance hazard.

### 2. [MEDIUM] Recursive call drops `persistDir` — silent loss of digest logging

**Location**: Line 419–425

```typescript
return runAgentWithRetry(
  session,
  Promise.resolve(),
  infraRetryMax,
  onComplete,
  // persistDir NOT passed — defaults to undefined
);
```

The recursive call omits the `persistDir` parameter. This means any retries happening in the recursive invocation will skip `upsertDigest()` calls (guarded by `if (persistDir)`). The infra_retry digest entries will be silently missing for post-loop retries and any retries within the recursive call's while-loop. This is a **data integrity** issue — retry telemetry will undercount actual retries.

### 3. [LOW] Time-of-check-time-of-use gap during delay window

**Location**: Lines 307–315 (delay + closed check)

```typescript
await new Promise((resolve) => setTimeout(resolve, delayMs));
// Guard: session may have been closed/aborted during the delay
if (session.closed) return;
```

During the delay (up to 30s for rate limits), the session is in a half-state: `session.error` and `session.agent.state.errorMessage` have been cleared (L300–301), the bad assistant message has been popped (L276–278), but no new request has been issued. If the session is examined during this window (e.g., by `buildResultFromSession()`, a status check, or `handleCompletion` from a timeout), it will see a session with:
- No error
- Messages potentially ending with a user message (the injected "Please continue.")
- Status still "running"

This is safe in the current codebase because JavaScript is single-threaded and the delay is a non-yielding `setTimeout`. External calls like `close()` set `session.closed = true` which is checked post-delay. However, the cleared error state means if `close()` fires during the delay, the session will be archived with no error message despite having failed.

### 4. [LOW] Message history mutation — popping messages is destructive

**Location**: Lines 275–278, Lines 396–400

```typescript
if (lastMsg?.role === "assistant") {
  messages.pop();
  session.agent.state.messages = messages;
}
```

The retry logic mutates the message array in place via `pop()`, then reassigns it. This is intentional (removing the bad assistant message before retry), but:

- **No backup**: The popped message is lost forever. If the retry also fails, the original error evidence is gone from the message history.  
- **Persistence race**: If the session-subscriber persists messages between the `pop()` and the retry's new assistant message, the persisted state will be missing the original error. On process restart, the session resumes without knowledge of the prior failure.

This is acceptable for transient errors (the whole point is to retry) but makes post-mortem debugging harder when retries also fail.

### 5. [LOW] "Please continue." injection accumulates on repeated empty responses

**Location**: Lines 282–287, Lines 402–408

If the message history ends on an assistant message after popping the bad one, a synthetic `"Please continue."` user message is injected. If the retry also produces an empty response, the next retry iteration pops the empty assistant message, sees the previous "Please continue." user message... and since it's a user message, no new injection occurs. **However**, in the post-loop path, the injection logic is duplicated and could inject a second "Please continue." if the first was consumed by the main loop.

With 5 retries of persistent empty responses, up to 5 "Please continue." messages could accumulate in history (each retry pops the empty assistant but injects a new user message). These consume context window tokens and persist to disk.

### 6. [INFO] Single-threaded safety — no actual race conditions

The retry system benefits from JavaScript's single-threaded event loop. The `await` points (delay, `agent.continue()`) yield control but all state mutations happen synchronously. There are no true race conditions between overlapping retries — only one retry runs at a time per session. The `session.closed` guard after each delay prevents zombie retries after abort.

### 7. [INFO] Retry detection is conservative and well-layered

`isRetryableInfraError()` has good guard rails:
- Returns `null` for closed sessions
- Returns `null` for non-running sessions
- Returns `null` after `lastTurnCalledFinish()` (prevents false positive on normal empty responses)
- Returns `null` for aborted sessions
- Returns `null` for overflow errors (retry won't help)
- Classifies by specificity: provider_outage → json_stream → http_retryable → empty_response

The pattern matching is string-based (fragile to wording changes in upstream providers), but this is pragmatic given the lack of structured error types from LiteLLM.

---

## Recommendations

1. **Fix the recursive call to pass `persistDir`** (Finding #2) — trivial one-line fix, restores digest logging for post-loop retries.

2. **Consider converting post-loop recursion to iteration** (Finding #1) — the post-loop catch could re-enter the while-loop instead of recursing. This would eliminate the recursion depth concern and the parameter-dropping bug. Pseudocode:
   ```typescript
   let needsRetryLoop = true;
   while (needsRetryLoop) {
     needsRetryLoop = false;
     // main while loop...
     // post-loop catch sets needsRetryLoop = true instead of recursing
   }
   ```

3. **Cap "Please continue." injections** (Finding #5) — before injecting, check if the last user message is already "Please continue." and skip if so. Minor token-waste prevention.

4. **Log popped messages** (Finding #4) — before `messages.pop()`, log the popped message content at debug level. Preserves failure evidence for post-mortem without keeping it in the agent's context window.
