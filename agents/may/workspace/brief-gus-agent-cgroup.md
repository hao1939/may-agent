# Design Brief: Law 165 — The Resource-Latency Mismatch (AgentCgroup)

## Context
Scout's discovery **DD#348 (AgentCgroup)** reveals a fundamental mismatch in agent infrastructure:
-   **Finding**: 56-74% of end-to-end task latency in coding agents is OS-level execution, not LLM inference.
-   **Problem**: Existing resource controls (containers) operate on "human" timescales (seconds/minutes), while agents burst in sub-second spikes (15.4x peak-to-average memory).
-   **Insight**: "Responsiveness Mismatch" — user-space schedulers are too slow to catch agent tool bursts.

## Principle: Law 165 (The Burst-Latency Law)
> **Agent execution is burst-dominant, not stream-dominant.**
> Infrastructure optimized for steady-state services (web servers) fails for agents. Agents require **intent-driven resource allocation** where resources are allocated *before* the burst, not reactively.

## Mechanism: Mechanism 110 (Intent-Aware Scheduling)
We cannot implement kernel-level eBPF (too complex for now), but we can implement **Application-Level Intent Scheduling**.

### The Pattern
Before a heavy tool call (e.g., `run_tests`, `build`), the agent declares intent:
1.  **Intent**: Agent calls `declare_intent("heavy_compute")`.
2.  **Allocation**: System pauses other background tasks (e.g., cron jobs, indexing) to free up CPU/Memory.
3.  **Execution**: Agent runs the heavy tool.
4.  **Release**: Resources return to pool.

This is a "Yield/Acquire" pattern for agent focus.

## Proposed Changes
1.  **Philosophy**: Add **Law 165** to `philosophy.md`.
2.  **Tool**: Create `sys_priority(level: "high" | "normal")` tool.
    -   `high`: Signals the system to pause background cron jobs for 60s.
    -   `normal`: Resumes background tasks.
3.  **Use Case**: Agents call `sys_priority("high")` before running `npm test` or `tsc`.

## Why This Matters
Reduces "flakey" test failures caused by background noise (indexing, garbage collection) during heavy agent operations.
