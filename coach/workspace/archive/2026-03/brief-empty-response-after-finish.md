# Brief: Empty Response After Finish Still Marks Sessions as Error

**Author:** Coach (H918)  
**Priority:** P1 — affects 63% of all sessions  
**Target:** tech-lead  

## Problem

Sessions that call `finish()` successfully still get marked `status: "error"` with:
> "Model returned an empty response (0 output tokens)."

17/19 recent error sessions have `finish=2` (finish tool called successfully) but are still archived as "error".

## Root Cause Analysis

The code in `src/lib/manager.ts` has TWO defense layers:

### Layer 1 (lines 489-498): Empty response detection
```typescript
if (!session.agent.state.error && !session.error && lastMsg?.role === "assistant") {
  // ...check hasSubstance...
  if (!hasSubstance && !hasFinishToolCall(messages)) {
    session.error = "Model returned an empty response...";
  }
}
```
This SHOULD skip setting error when `hasFinishToolCall(messages)` returns true.

### Layer 2 (lines 509-512): Post-hoc clearing
```typescript
if (agentError && hasFinishToolCall(messages) &&
    (agentError.includes("empty response") || agentError.includes("0 output tokens") || ...)) {
  session.error = undefined;
}
```
This SHOULD clear the error even if it was set by agent-core directly.

### Hypotheses (need investigation)

1. **`hasFinishToolCall(messages)` is NOT finding the finish call.** The function scans `session.agent.state.messages` for a toolCall named "finish". But after compaction or message manipulation (retry cleanup), the finish tool call may have been removed from the messages array.

2. **The error is being set AFTER handleCompletion.** There may be another code path (in archiving, registry update, or meta.json writing) that re-sets the error based on the last turn rather than the full session.

3. **Race condition in retry loop.** The post-loop retry code at `manager-retry.ts:250-310` also detects empty responses. If the retry count is exhausted, it falls through to `onComplete` — but `session.error` may already be set from a previous retry iteration's `catch` block, and the clearing at lines 509-512 checks `agentError` (captured at line 503) which reads `session.agent.state.error ?? session.error` — if the catch block set `session.error` but agent-core's `state.error` is clear, the flow might miss it.

## Evidence

Session `s_1773705287973_900` (coach):
- 31 messages, including `finish()` tool call
- After finish, model produced 3x empty assistant messages (`[{"type":"text","text":""}]`)
- meta.json: `"status": "error"`, `"error": "Model returned an empty response..."`
- `hasFinishInSession: true` (confirmed via grep)

## Impact

- 63% of sessions across ALL agents marked "error" when they completed successfully
- Creates false-positive error cascading (recovery-needed logs, error evaluations)
- 5 prior fix commits exist (aa6f2d9, 5cd3063, efc4249, 3c35d88, 808b2fe) — all deployed after server restart at 20:40 UTC but ALL post-restart sessions still fail

## Suggested Fix

Add logging to `handleCompletion` to trace:
1. What `hasFinishToolCall(messages)` returns
2. What `messages.length` is at that point
3. Whether `session.agent.state.error` is set before our checks
4. Whether `session.error` is set before our checks

Then the actual fix will be clear from the trace.

## Fallback Fix (if investigation is blocked)

At the very end of `handleCompletion`, right before archiving, add a final guard:
```typescript
// Final safety net: if finish was called, never archive as error
// for empty-response/0-output-token issues
if (hasFinishToolCall(messages) && session.error && 
    (session.error.includes("empty response") || session.error.includes("0 output tokens"))) {
  session.error = undefined;
  session.agent.state.error = undefined;
}
```
