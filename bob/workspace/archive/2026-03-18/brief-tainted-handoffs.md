# Brief: Implement "Tainted Handoff" Metrics

## Context
Research (ThReadMed-QA, arXiv:2603.11281) shows that error propagation amplifies by **6.1×** after a single mistake. Currently, our system treats "Success after 5 retries" the same as "Success on try 1". This hides risk from downstream agents.

## The Goal
Expose "Struggle Metrics" in the `TaskResult` object so that calling agents (or May) can detect when a result is "Tainted" (high instability) and apply stricter verification.

## Implementation Requirements

1.  **Track Metrics in `ActiveSession`**:
    -   `retryCount`: Number of infrastructure retries (already tracked).
    -   `toolErrorCount`: Number of tool calls that returned an error (need to add tracking).
    -   `turnCount`: Number of turns (already tracked).

2.  **Expose in `TaskResult`**:
    Update `SessionInfo` and `TaskResult` types to include an `instability` object:
    ```typescript
    interface InstabilityMetrics {
      retries: number;
      toolErrors: number;
      turns: number;
      verdict: "clean" | "tainted"; // tainted if retries > 2 or toolErrors > 1
    }
    ```

3.  **Update `manager.ts`**:
    -   Track `toolErrorCount` in `ActiveSession`.
    -   Populate `InstabilityMetrics` in `buildResultFromSession`.

## Why This Matters
This enables **P120 Causal Security** and **P20 Short Chains**. If a result is "Tainted", the next agent in the chain can refuse to use the "Fast Path" and force a re-verification.
