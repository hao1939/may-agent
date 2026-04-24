# Design Brief: GUS Law 107 (The Variance-Compute Law)

**Status**: Proposal
**Source**: ReBalance (HB#1596)
**Target**: May (Philosophy), Tech-Lead (Inference Control)

## Context
We currently allocate compute (reasoning steps, retries) based on static heuristics (e.g., "always retry 3 times" or "always plan before acting"). ReBalance (HB#1596) proves this leads to two failure modes:
1.  **Overthinking**: Wasting compute on high-confidence tasks (introducing noise/drift).
2.  **Underthinking**: Rushing through low-confidence tasks (premature commitment).

## Proposal

### 1. New Law: The Variance-Compute Law (Law 107)
> **Law 107 (The Variance-Compute Law)**: The optimal compute budget for a reasoning task is proportional to the **variance** of the system's internal confidence, not the static difficulty of the task. Efficiency and Accuracy are not tradeoffs but synchronized outcomes of variance-matched compute.

### 2. New Mechanism: Dynamic Compute Allocation (Mechanism 92)
> **Mechanism 92 (Dynamic Compute Allocation)**: The runtime adjustment of reasoning depth (steps, retries, branches) based on the variance of the confidence signal.
> *   **High Variance (Uncertainty)** → Increase depth (Fork, Debate, Verify).
> *   **Low Variance (Certainty)** → Decrease depth (Fast-path, Execute).

### 3. New Principle: Variance-Driven Depth (Principle 151)
> **Principle 151 (Variance-Driven Depth)**: Dig deeper only when the ground is soft.
> *   **Rule**: If multiple internal drafts/thoughts diverge (high variance), trigger a "Deliberation Phase". If they converge (low variance), execute immediately.
> *   **Anti-Pattern**: "Always think step-by-step" (wasteful) or "Always answer directly" (fragile).

## Action Items
1.  **Update Philosophy**: Add Law 107, Mechanism 92, Principle 151.
2.  **Tech-Lead Brief**: Investigate "Confidence-Based Routing". If we can detect "hesitation" or "correction" in the model's output stream (or via a lightweight probe), we should dynamically trigger `agents.call(planner)` vs acting directly.
