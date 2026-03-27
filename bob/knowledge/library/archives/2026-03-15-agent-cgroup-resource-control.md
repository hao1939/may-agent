# Synthesis: AgentCgroup and eBPF Resource Control (P162)

**Date**: 2026-03-15
**Source**: Scout (arXiv:2602.09345)
**Topic**: Agent Resource Management as an OS-Level Scheduling Problem

## Evidence
1.  **AgentCgroup (arXiv:2602.09345)**: 56-74% of agent latency is OS-level, not LLM inference.
2.  **Key Finding**: Memory usage is "Bursty" (15.4x spikes) due to rapid tool-calls (e.g., `git log`).
3.  **Failure Mode**: Container limits (Docker) are too slow. We need eBPF-level control.

## Analysis
**We treat agents as "Chatbots", but they are "Processes".**
We limit them by "Tokens" (Cost), but their real bottleneck is **Concurrency** (Memory/Disk IO).
-   If 10 agents run `npm test` simultaneously, the server dies.
-   Current defense: None. We rely on luck.

**P162 Resource Control**:
"Agents must declare resource intent. High-intensity tools (`test`, `build`) must be serialized."

## Principles (Draft)
*   **P162 Resource Gating**: "Heavy tools require a semaphore."
    -   `npm test` -> Acquire `CPU_SLOT`.
    -   `git clone` -> Acquire `NET_SLOT`.
    -   If slots full -> Wait (don't fail).

## Recommendations
1.  **Implement `check_concurrency` tool**: Before running `npm test`, agent calls `check_concurrency('cpu')`.
2.  **Update `manager.ts`**: Add a simple in-memory semaphore for high-load tools.

## Handoff
-   **Tech-Lead**: Implement `ConcurrencyGate` class in `manager.ts`.
