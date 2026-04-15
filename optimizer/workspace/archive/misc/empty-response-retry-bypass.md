# Finding: Empty Response Retry Bypass

**Date**: 2026-03-16
**Severity**: HIGH (35 sessions affected in last 2 hours, ~28% of all errors)
**Status**: Proposal — needs tech-lead implementation

## Problem

Sessions that receive empty responses from the model (0 output tokens, `stopReason: "stop"`) are NOT being retried despite `isRetryableInfraError()` having Pattern 2 specifically for this case.

### Evidence

- **36 out of 36** empty response errors have `retries=0` in the last 2 hours
- Error message: "Model returned an empty response (0 output tokens)"
- Affects multiple agents: may, optimizer, scout-c42, amy, may-c42
- This is the **#1 error type** (35/78 = 45% of all errors)

### Root Cause

**Race condition in error detection flow:**

1. `runAgentWithRetry()` calls `agent.prompt()` or `agent.continue()`
2. Model returns empty response with `stopReason: "stop"` — agent-core treats this as NORMAL completion (no error thrown)
3. `await initialCall` resolves successfully (no catch)
4. `isRetryableInfraError()` is called — Pattern 2 checks for empty assistant content
5. **BUT**: the condition `if (!session.agent.state.error && !session.error)` may pass, yet `session.status` might have already changed, OR the empty-response detection in `handleCompletion()` (line ~486-498 of manager.ts) sets the error AFTER the retry loop has already exited via `onComplete(session)`

The detection of empty responses is **duplicated** between:
- `isRetryableInfraError()` in manager-retry.ts (lines 92-107) — should catch during retry loop
- `handleCompletion()` in manager.ts (lines 486-498) — runs AFTER retry loop exits

If the retry-side detection isn't matching, the error only gets flagged in completion — too late for retries.

### Likely Specific Cause

`isRetryableInfraError` checks `session.status !== "running"` at line 37. When agent-core finishes cleanly (empty but no error), the agent's state machine may signal completion, causing status to not be "running" by the time the retry check runs.

## Proposed Fix

Move the empty-response detection to happen BEFORE calling `onComplete`:

```typescript
// In runAgentWithRetry, after the while loop exits:

// Pre-check: detect empty response BEFORE calling onComplete
// This catches cases where the model returns stopReason="stop" with 0 content
const messages = session.agent.state.messages;
const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
if (!session.error && lastMsg?.role === "assistant") {
  const content = Array.isArray(lastMsg.content) ? lastMsg.content : [];
  const hasSubstance = content.some(
    (block: any) =>
      (block?.type === "text" && block.text?.trim()) ||
      block?.type === "toolCall",
  );
  if (!hasSubstance && session.infraRetryCount < infraRetryMax) {
    // Empty response — retry it
    session.infraRetryCount++;
    // ... same retry logic as the main loop
  }
}
```

**Alternative (simpler)**: Remove the `session.status !== "running"` guard from `isRetryableInfraError()`, or relax it to also accept statuses that indicate the agent just finished normally.

## Impact

- **35 sessions in 2 hours** would have been retried instead of failing
- At ~$0.85/session average cost, that's **~$30/session-hour wasted**
- Combined with 429 rate limit errors, this accounts for **78% of all session errors**
- Fixing this alone could reduce the system error rate from 63% to ~35%

## Files to Change

- `src/lib/manager-retry.ts` — add post-loop empty-response check OR relax status guard
- `src/lib/manager.ts` — coordinate with handleCompletion to avoid double-detection
