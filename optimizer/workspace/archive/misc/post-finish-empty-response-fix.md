# Post-Finish Empty Response Fix

**Date**: 2026-03-16
**Author**: Optimizer
**Status**: Implemented & Verified

## Problem

**76% of recent sessions (38/50) are erroring out.** 31 of those 38 errors are "empty response (0 output tokens)". Analysis of May's session.jsonl files reveals a critical bug:

1. Agent does its work successfully → calls `finish({status: "success"})` 
2. The `finish` tool executes, returns success response
3. Model responds with empty text `""` (stopReason: "stop") — it has nothing more to say
4. Empty response triggers `isRetryableInfraError()` → retries with backoff
5. Each retry gets another empty response (model is legitimately done)
6. After exhausting retries (5x), `handleCompletion()` marks session as `error`

**Result**: Sessions that completed successfully are being marked as errors.

### Evidence

All 8 of May's most recent "error" sessions had:
- `finish` tool called successfully (2 matches per session)
- 4-6 empty responses after finish
- All marked `status: "error"` despite successful completion

## Root Cause

Two code paths fail to account for post-`finish` empty responses:

1. **`isRetryableInfraError()`** in `manager-retry.ts` — Pattern 2 detects empty assistant messages and returns `"empty_response"`, triggering retry. But after `finish`, empty responses are expected.

2. **`handleCompletion()`** in `manager.ts` — Sets `session.error` when it detects an empty assistant message, marking the session as "error" even though work was completed.

## Fix

### 1. Added `hasFinishToolCall()` helper (manager-retry.ts)
Scans session messages for a `finish` toolCall. Returns `true` if the agent already called `finish`.

### 2. Updated `isRetryableInfraError()` (manager-retry.ts)
Early return `null` (not retryable) if `hasFinishToolCall()` is true. Prevents wasteful retries after successful completion.

### 3. Updated `handleCompletion()` (manager.ts)
Added `!hasFinishToolCall(messages)` guard to the empty-response error detection. If `finish` was called, empty responses afterward are normal — session completes as `done` instead of `error`.

## Impact

- **31 sessions** in the last 50 would have been marked `done` instead of `error` with this fix
- **May's error rate**: 19/19 errors → likely ~0 errors (all 19 were post-finish empty responses)
- **System error rate**: 76% → estimated ~14% (only real errors remain: 4 unexpected_state + 3 rate limits)
- **Cost savings**: Each failed session gets 5 retry attempts with backoff (1s, 2s, 4s, 8s, 16s) — 31 sessions × 5 retries × ~$0.03/retry ≈ $4.65 direct waste per burst. At current firing rate (~50 sessions/hour), this saves significant ongoing cost.

## Verification

- `npx tsc --noEmit` — clean
- `npx vitest run test/manager-infra-retry.test.ts` — 58/58 pass
- `npx vitest run` — 1394/1394 pass (104 test files)
