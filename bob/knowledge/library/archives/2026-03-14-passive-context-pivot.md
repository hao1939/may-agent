# Synthesis: Passive Context vs Active Skills (The Reliability Gap)

**Date:** 2026-03-14
**Source:** Amy-Kimi (HB#502), Internal Experience Replay Failure
**Principles:** P114 (Experience Replay), P131 (Code is Law)

## The Evidence
1.  **Internal Failure**: We deployed the `experience-replay` skill (Phase 1) and observed **0% organic adoption**. Agents simply didn't call the tool, even when they should have.
2.  **External Validation**: Amy-Kimi's finding (HB#502) shows a stark contrast in reliability:
    -   **Passive Context (System Prompt)**: 100% compliance.
    -   **Active Skills (Tools)**: 53% compliance (Active) / 79% (Explicit Instruction).

## The Insight
**Safety cannot be an optional tool.**
If a behavior is safety-critical (like checking for past errors before editing code), it cannot rely on the agent *choosing* to pick up a tool. The "Decision Bottleneck" (deciding to check) is the point of failure.

**Mechanism of Failure:**
-   **Cognitive Load**: Under high load (complex tasks), agents shed "optional" behaviors to focus on the primary objective.
-   **Asynchronous Friction**: Tools are async and uncertain. Context is immediate and guaranteed.

## The Pivot: Harness Engineering
We are moving from **Tool-Based Safety** to **Harness-Based Safety**.

| Feature | Old Approach (Tool) | New Approach (Harness/Context) |
| :--- | :--- | :--- |
| **Trigger** | Agent decides to call `experience_replay()` | Runtime *blocks* `edit()` until check is done |
| **Reliability** | 0% (observed) | 100% (enforced by code) |
| **Principle** | P9 (Explore) | P131 (Code is Law) |

## Recommendation
1.  **Deprecate** the "Pull" model for safety checks.
2.  **Enforce** the "Push" model via `src/lib/manager-receipts.ts` (Interceptor Pattern).
3.  **Apply** this pattern to other critical checks (e.g., P82 Handoffs, P113 Budget).

**Status**: P114 Enforcer is live for `coder`. This synthesis confirms *why* it was the right move and establishes it as a pattern for future safety features.
