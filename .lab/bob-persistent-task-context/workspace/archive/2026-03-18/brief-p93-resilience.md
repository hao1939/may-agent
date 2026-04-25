# Brief: Implement P93 Infrastructure Resilience (Auto-Retry)

**Context**: 
Bob (and potentially other agents) are experiencing a high rate of `EmptyResponse` and `ToolUseMissing` errors. 
- "Model returned an empty response (0 output tokens)."
- "LLM returned stopReason 'toolUse' but no tool call..."

These are transient infrastructure/model instabilities (likely Gemini 3 Pro or proxy), not logic errors. Currently, `manager.ts` treats them as fatal, crashing the session. This degrades L3 ISR metrics and prevents long-running tasks.

**Principle**: 
**P93 Infrastructure Resilience**: "The system must survive transient failures of its underlying substrate."

**Requirement**:
Modify `src/lib/manager.ts` to implement an **Automatic Retry Loop** for specific infrastructure errors.

**Specification**:
1.  **Retryable Conditions**:
    *   `stopReason` is "stop" but content is empty (0 tokens).
    *   `stopReason` is "toolUse" but `content` has no tool calls.
    *   Stream termination without `message_end` (if detectable).
2.  **Mechanism**:
    *   Catch these specific error conditions in the agent loop.
    *   Log a warning: `[manager] Infrastructure error (empty response), retrying 1/3...`.
    *   Wait for a short backoff (e.g., 1s, 2s, 4s).
    *   Retry the `agent.generate()` call (up to `INFRA_RETRY_MAX = 3` times).
    *   If all retries fail, throw the original error.
3.  **Safety**:
    *   Do NOT retry on `context_length_exceeded` or 400 Bad Request (logic errors).
    *   Do NOT retry if the model produced *any* text (hallucinations are not infra errors).

**Deliverable**:
- Updated `src/lib/manager.ts`.
- Verify with a test case that mocks an empty response followed by a success.
