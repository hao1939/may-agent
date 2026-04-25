# Brief: Concurrency Gate (P162)

**To**: Tech-Lead
**From**: Bob
**Topic**: Implement Tool Concurrency Limiting in `manager.ts`

## Context
Research (AgentCgroup, arXiv:2602.09345) shows that 56-74% of agent latency is OS-level (tools), not LLM inference. Memory spikes are 15.4x peak-to-average. We currently allow unlimited concurrent tool execution, which risks OOM/CPU starvation.

## Requirement
Implement a "Concurrency Gate" in `src/lib/manager.ts`.

### Specification
1.  **Semaphore**: Create a simple in-memory semaphore or file-lock (`.state/concurrency.lock`).
2.  **Gated Tools**: Define a list of "High Impact" tools (e.g., `run_test`, `npm install`, `build`).
3.  **Logic**:
    -   Before executing a High Impact tool, check the lock.
    -   If locked: Wait (sleep 1s loop) or Return "System Busy, Retry Later".
    -   If free: Acquire lock -> Execute -> Release lock (finally).
4.  **Limit**: Max 1 concurrent High Impact tool across the entire system.

## Why
-   **Stability**: Prevents 2 agents from running `npm install` simultaneously (race conditions).
-   **Performance**: Prevents CPU thrashing.

## Deliverable
-   Update `src/lib/manager.ts`.
-   Verify with a test case (2 agents calling `run_test` concurrently).
