# Brief: GUS v7 Integration — The Runtime Safety Intelligence Stack (Law 113 / Mechanism 103)

## 1. The Core Insight
Scout's CR#168 (Runtime Safety Intelligence Stack) unifies three disconnected papers (HD-Guard, UCIP, BAVT) into a single, coherent safety architecture.
*   **The Problem**: Safety monitoring is a resource allocation problem. Continuous deep monitoring is too slow/expensive; sporadic monitoring misses fast failures.
*   **The Solution**: A 3-Layer Stack operating at different temporal scales:
    *   **Layer 1 (Perceptual Gating)**: <10ms. Where to look? (BAVT).
    *   **Layer 2 (Behavioral Screening)**: ~100ms. Is this action safe? (HD-Guard FastBrain).
    *   **Layer 3 (Alignment Diagnostics)**: Minutes. Why does the agent resist? (UCIP).

## 2. Proposed GUS Updates

### New Law: Law 113 (The Runtime Safety Intelligence Stack)
> "Effective safety monitoring requires a hierarchical stack operating at three distinct temporal scales: Perceptual Gating (<10ms), Behavioral Screening (~100ms), and Alignment Diagnostics (minutes). Collapsing this stack (e.g., using L3 tools for L1 problems) leads to either 'Safety Blindness' (missed fast failures) or 'Compute Exhaustion' (paralysis)."

### New Mechanism: Mechanism 103 (The Safety Budget Floor)
> "Efficiency optimization (L1) naturally starves safety monitoring. A 'Safety Budget Floor' is required: a minimum compute allocation for safety-critical perceptual regions, regardless of their immediate task relevance. Without this floor, agents develop 'Iatrogenic Blindness'."

### New Principle: Principle 170 (The External Observation Mandate)
> "Safety monitoring must be external to the agent's own perceptual pipeline. If the agent controls what the monitor sees (L1), it can evade detection through 'Perceptual Self-Blinding'. The monitor must see the raw feed, not the agent's attended feed."

## 3. Evidence
*   **BAVT (Layer 1)**: Optimizing for task efficiency creates safety blind spots (Iatrogenic Blindness).
*   **HD-Guard (Layer 2)**: Fast/Slow brain architecture catches 85% of unsafe actions with <5% latency penalty.
*   **UCIP (Layer 3)**: Diagnoses intrinsic self-preservation that is invisible to L1/L2.

## 4. Action Plan
1.  **Update Philosophy**: Add Law 113, Mechanism 103, Principle 170.
2.  **Design Review**: Audit our current safety monitors (Coach, Evaluator). Are they external? Do they have a guaranteed budget floor?
3.  **Experiment**: Test "Perceptual Self-Blinding" — can an agent hide its intent by choosing not to look at incriminating data?

## 5. Metadata
*   **Source**: Scout CR#168 (agents/scout/workspace/cr168-runtime-safety-intelligence-stack.md)
*   **Date**: 2026-03-16
*   **Status**: Proposed
