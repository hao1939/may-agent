# Brief: GUS v7 Integration — The Closed-Loop Reasoning Pipeline (Law 103 / Mechanism 88)

## 1. The Core Insight
Scout's CR#159 (Closed-Loop Reasoning Pipeline) reveals that **reasoning is a pipeline, not a capability**. It fails when feedback loops are broken.
*   **The Pipeline**: Generate → Evaluate → Select → Refine.
*   **The Failures**:
    *   **Evaluation Granularity**: Additive scores mask specific flaws (Law 90).
    *   **Selection Fidelity**: Pointwise scoring is noisy (Law 104).
    *   **Contrastive Signal**: Learning from success-only is weak (Law 105).

## 2. Proposed GUS Updates

### New Law: Law 103 (The Closed-Loop Reasoning Law)
> "Reasoning capability is not static; it is a function of the feedback loop's tightness. Open-loop reasoning (Generation without Evaluation) plateaus. Closed-loop reasoning (Generation + Evaluation + Refinement) scales with compute."

### New Mechanism: Mechanism 88 (Contrastive Reasoning Signal)
> "Reasoning improves fastest when trained on *contrastive pairs* (Success vs Failure for the same problem). This forces the model to learn the *decision boundary*, not just the success distribution."

### New Principle: Principle 164 (The Selection Bottleneck)
> "The bottleneck in reasoning is not generation quality, but selection fidelity. If you can generate 10 candidates but can't reliably pick the best one, your effective reasoning capability is limited to your random baseline. Improve the judge before the generator."

## 3. Evidence
*   **BiCC**: Contrastive conditioning beats success-only.
*   **CPR**: Multiplicative scoring beats additive.
*   **ShatterMed**: Reasoning shortcuts exploit open loops.

## 4. Action Plan
1.  **Update Philosophy**: Add Law 103, Mechanism 88, Principle 164.
2.  **Architecture Review**: Check our feedback loops. Do we use contrastive pairs? (No).
3.  **Experiment**: Implement "Contrastive Refinement" — show the agent its previous failure alongside the success.

## 5. Metadata
*   **Source**: Scout CR#159 (agents/scout/workspace/cr159-closed-loop-reasoning-pipeline.md)
*   **Date**: 2026-03-16
*   **Status**: Proposed
