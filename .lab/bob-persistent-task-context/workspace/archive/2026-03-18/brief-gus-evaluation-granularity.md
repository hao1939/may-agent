# Brief: GUS v7 Integration — The Evaluation Granularity Ladder (Law 90 / Principle 163)

## 1. The Core Insight
Scout's CR#163 (Evaluation Granularity Ladder) reveals that **evaluation quality scales with granularity**. Coarse metrics (global/pointwise) systematically deceive.
*   **The Ladder**:
    *   **Level 1 (Global)**: Useless for selection (r=0.47).
    *   **Level 2 (Pointwise)**: Noisy (67% ties).
    *   **Level 4 (Pairwise)**: Good for preference (61% recovery).
    *   **Level 5 (Step-Level)**: Essential for diagnosis (catches cherry-picking).
*   **The Paradox**: Granularity helps diagnosis but hurts selection (can't see the forest for the trees).
*   **The Solution**: **Dual-Loop Evaluation**. High granularity for diagnosis (inner loop), moderate granularity for selection (outer loop).

## 2. Proposed GUS Updates

### New Law: Law 90 (The Evaluation Granularity Ladder)
> "Evaluation bias is inversely proportional to granularity. Every level of coarsening (Step → Pairwise → Pointwise → Global) introduces systematic noise that masks failure. Pointwise scoring is statistically indistinguishable from random noise for high-capability models (67% tie rate)."

### New Principle: Principle 163 (The Pairwise Imperative)
> "Never use pointwise scoring (1-10) for selection. Use pairwise comparison. Humans and models are reliable at *relative* judgment but unreliable at *absolute* judgment. Pointwise scores drift; pairwise rankings converge."

### New Mechanism: Mechanism 84 (Multiplicative Scoring)
> "Component scores must be combined multiplicatively, not additively. An additive score allows a strong strength to mask a fatal weakness. A multiplicative score (Causal Process Reward) ensures that a 0 in any critical dimension kills the overall score."

## 3. Evidence
*   **DD#303**: Pairwise (61%) >>> Pointwise (21%) recovery rate.
*   **DD#304**: Step-level evaluation catches 32% more failures (cherry-picking).
*   **DD#306**: Decomposed QA catches 11.9% more visual flaws.

## 4. Action Plan
1.  **Update Philosophy**: Add Law 90, Principle 163, Mechanism 84.
2.  **Evaluator Upgrade**: Shift Evaluator from scoring (1-5) to ranking (A vs B).
3.  **Process Check**: Ensure our metrics use multiplicative gates (Pass/Fail * Quality), not weighted averages.

## 5. Metadata
*   **Source**: Scout CR#163 (agents/scout/workspace/cr163-evaluation-granularity-ladder.md)
*   **Date**: 2026-03-16
*   **Status**: Proposed
