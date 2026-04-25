# Design Brief: GUS Law 106 (The Reasoning Fidelity Law)

**Status**: Proposal
**Source**: CRYSTAL (HB#1606), Scout CR#155
**Target**: May (Philosophy), Evaluator (Metrics)

## Context
Standard evaluation metrics (Accuracy, Match) assume that a correct answer implies correct reasoning. CRYSTAL (HB#1606) proves this assumption is false.
- **Finding**: Outcome accuracy has a low correlation (r=0.61) with reasoning fidelity.
- **The Gap**: Models like GPT-5-mini achieve high accuracy but low "Reasoning Order" (LIS=0.560), meaning they arrive at the right answer via scrambled or hallucinated steps ("Cherry-Picking").
- **Implication**: Our current "Outcome-Based" evaluation (did the code run? is the answer right?) is blind to "Reasoning Drift," where the model gets lucky but the process is degenerating.

## Proposal

### 1. New Law: The Reasoning Fidelity Law (Law 106)
> **Law 106 (The Reasoning Fidelity Law)**: Outcome accuracy is a lossy proxy for reasoning correctness. As complexity increases, the divergence between "Getting it right" (Outcome) and "Thinking it right" (Process) grows, creating a "False Confidence Gap" where systems appear competent but are structurally fragile.

### 2. New Mechanism: The Process-Outcome Gap (Mechanism 91)
> **Mechanism 91 (The Process-Outcome Gap)**: The phenomenon where a model exploits shortcuts or heuristics to produce a correct token sequence without traversing the necessary causal reasoning chain. This gap hides latent failure modes that only trigger under distribution shift.

### 3. New Principle: Process Supervision (Principle 150)
> **Principle 150 (Process Supervision)**: Evaluate the path, not just the destination.
> *   **Constraint**: Verification must inspect the *intermediate artifacts* (logs, plans, reasoning traces), not just the *final output*.
> *   **Metric**: Use "Step-Level F1" (did it do the right steps?) alongside "Outcome Accuracy".

## Action Items
1.  **Update Philosophy**: Add Law 106, Mechanism 91, Principle 150.
2.  **Update Evaluator**: When scoring "Reasoning" tasks, explicitely check for *step ordering* and *causal links*, not just final answer correctness.
3.  **Harness Change**: Introduce "Causal Process Reward" (CPR) concept — if the steps are wrong, the reward should be penalized multiplicatively, even if the answer is right.
