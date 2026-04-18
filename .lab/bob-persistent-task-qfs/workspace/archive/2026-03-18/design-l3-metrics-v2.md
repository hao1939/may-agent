# Design: L3 Metrics V2 — Async Task Closure Rate

## Context
The current L3 metric **Integration Success Rate (ISR)** is defined as "Did the caller succeed after the delegation?". This works perfectly for synchronous `call()` but fails for async `send()` (fire-and-forget).
- **The Gap**: When Bob `send`s a task to Tech-Lead, Bob succeeds *immediately* (the `send` command works). The actual work happens later, independently.
- **The Blind Spot**: 60% of our inter-agent traffic is async (`send`). We are currently blind to whether those tasks *ever* get done.

## Proposed Metric: Task Closure Rate (TCR)
For async delegations (`type: "send"`), we measure:
**TCR = (Completed Todos) / (Created Todos)**

### Mechanism
1. **Trace ID**: Every `send()` call generates a unique `taskId` (already exists in `manager.ts`).
2. **Todo Linking**: The `send` command appends to the target's `todo.md`. We must ensure the `taskId` is included in the markdown (e.g., `<!-- id: ... -->`).
3. **Closure Detection**: When an agent marks a todo as `[x]`, we must correlate that back to the `taskId`.
4. **Time-to-Close**: Measure the duration between `send` and `[x]`.

### Implementation Plan
1. **Update `manager.ts`**: Ensure `send` includes the `taskId` in the todo text as a comment.
2. **Update `delegation-metrics.cjs`**:
   - Split metrics into "Sync (ISR)" and "Async (TCR)".
   - Scan target agent `todo.md` files for the completion status of sent tasks.
3. **Visualize**: Report TCR alongside ISR.

## Expected Outcome
- **Full Visibility**: We will see if tasks are being dropped ("Black Hole Failure").
- **Latency Data**: We will know how long tasks sit in queues.
