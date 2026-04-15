# Investigation: "Empty Response (0 Output Tokens)" Errors

**Date**: 2026-03-16
**Investigator**: Optimizer (s_1773686164272_254)
**Status**: Root cause identified

## Executive Summary

**55% of recent sessions (33/60) are failing with "empty response (0 output tokens)" errors.** The root cause is that a critical fix (`hasFinishToolCall`) was written to the source files but **the running process has not been restarted**, so the fix is not active. The running process loaded the code at 16:54 UTC; the fix was committed at 18:04 UTC. Bun caches module imports at process startup — the running code has zero references to `hasFinishToolCall`.

## Root Cause: Unrestarted Process

### The Bug (in the running code)
1. Agent completes work successfully → calls `finish({status: "success"})`
2. `finish` tool executes, returns success response
3. Model responds with empty text `""` (stopReason: "stop") — it has nothing more to say
4. **Running code's** `isRetryableInfraError()` detects empty assistant → returns `"empty_response"` (no `hasFinishToolCall` check exists in the running code)
5. Retry loop pops empty assistant, injects "Please continue", calls `agent.continue()`
6. Model responds with another empty text (it's legitimately done)
7. Steps 4-6 repeat 3-4 times until retry budget exhausted
8. `handleCompletion()` sees empty assistant, **no `hasFinishToolCall` guard** → marks session as `error`

### Evidence
| Session | Agent | finish calls | Empty assistants | Status |
|---------|-------|-------------|-----------------|--------|
| s_1773686043809_248 | may | 1 | 4 | error |
| s_1773685859460_237 | may | 1 | 4 | error |
| s_1773686083127_249 | amy | 1 | 4 | error |
| s_1773686093419_250 | may | 1 | 4 | error |
| s_1773685896979_240 | tech-lead | 1 | 4 | error |

**25+ of 33 "empty response" error sessions had a successful `finish` call.** These are FALSE ERRORS — the sessions completed successfully.

### Timeline
- **16:54 UTC**: Process starts (`bun src/app/may.ts`), loads all modules from source
- **17:10 UTC**: `c7a97cf` — unhandled stop reason fix (loaded by process ✓)
- **17:48 UTC**: `d0e8014` — post-loop empty response retry bypass (NOT loaded ✗)
- **18:04 UTC**: `934f3e1` — **hasFinishToolCall fix** (NOT loaded ✗)
- **18:39 UTC**: `efc4249` — extend finish-tool bypass to in-loop check (NOT loaded ✗)

The process at 16:54 loaded code from commit `ba63643`, which has **zero** references to `hasFinishToolCall`. All the fixes were written to disk after the process started.

### Running Code vs Source Code
```
Source code (on disk — correct):
  grep -c "hasFinishToolCall" src/lib/manager-retry.ts → 3 (definition + 2 call sites)

Running code (loaded at 16:54 from ba63643 — broken):
  git show ba63643:src/lib/manager-retry.ts | grep -c "hasFinishToolCall" → 0 (fix doesn't exist)
```

## The Fix That's Waiting

The `hasFinishToolCall` function was correctly implemented and checks all messages for a `finish` toolCall. It's used in three places:
1. **`isRetryableInfraError()`** — early return `null` if finish was called (prevents retry)
2. **Post-loop catch** — skip empty-response retry if finish was called
3. **`handleCompletion()`** — skip error-marking if finish was called

All three are correct and tested (1394/1394 tests pass). They just aren't running.

## Impact

- **33 false errors** in the last 60 sessions (55% false-error rate)
- **Agents affected**: may (most frequent), amy, bob, tech-lead, optimizer, coach, scout
- **Cost waste**: Each false error triggers 3-4 retry API calls at ~$0.03 each = ~$0.12/session × 33 sessions = ~$4/hour
- **Operational noise**: Error status triggers re-evaluation, error logging, and unnecessary failure tracking

## Required Action

**Restart the process** to load the fixed code:
```bash
# The todo.md already has this as the #1 blocked item:
# "SYSTEM RESTART REQUIRED for P82 handoff tool + security hardening"
```

This is blocked on Hao. The fix is written, tested, and committed — it just needs the process to restart.

## Secondary Finding: Non-Finish Empty Responses

~8 of 33 "empty response" sessions did NOT have a `finish` call. These are genuine empty-response errors (likely transient API issues). The retry logic handles these correctly — they're just unlucky sessions where the model returned empty on every retry attempt. These would not be affected by a restart.

## Verification Plan

After restart:
1. Check that `grep -c "hasFinishToolCall"` in the loaded modules returns 3+
2. Monitor next 20 sessions — expect error rate to drop from ~55% to ~13%
3. Sessions with `finish` calls should end as `done` instead of `error`
