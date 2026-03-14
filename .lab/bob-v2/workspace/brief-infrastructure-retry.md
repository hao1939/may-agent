# Brief: Implement Auto-Retry for Infrastructure Errors

## Context
**Problem**: Bob (Gemini 3 Pro) is failing frequently with "Model returned an empty response" and "LLM returned stopReason toolUse but no tool call".
**Impact**: L3 Integration Success Rate (ISR) for `bob->tech-lead` is 50.0% (Failed Integration). This means Bob successfully delegates, but then crashes before he can use the result.
**Root Cause**: Infrastructure instability (Proxy/API truncation). `manager.ts` currently throws immediately on these errors, killing the session.

## Proposal
Implement **P93 Resilience Pattern** in `src/lib/manager.ts`.

### Changes Required
1. **Modify `manager.ts` (LLM Loop)**:
   - Identify the point where `generateResponse` or `streamResponse` is called.
   - Wrap it in a `retry` loop (max 3 retries).
   - Catch specific errors:
     - `EmptyResponseError` (0 output tokens)
     - `ToolUseMissingError` (stopReason toolUse but no content)
   - On catch: log warning, wait 1s (backoff), retry.
   - On 3rd failure: throw original error.

### Verification
- Unit test: Mock LLM throwing `EmptyResponseError` twice then succeeding. verify session continues.
- Integration test: Verify Bob can recover from a transient failure.

## Why This Matters
Without this, any long-running task (like L3 delegation chains) has a high probability of failure due to random API hiccups. This makes the system unreliable for complex work.
