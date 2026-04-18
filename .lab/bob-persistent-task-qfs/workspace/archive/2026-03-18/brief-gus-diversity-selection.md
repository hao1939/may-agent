# Design Brief: The Diversity-Selection Synthesis (Law 83/84)

**Source**: Scout DD#301 (Self-Convergence) and DD#303 (Best-of-N Failure)
**Context**: Two critical findings undermine standard MAS assumptions. (1) Models are converging, reducing the value of "debate". (2) Standard "LLM-as-Judge" scoring is statistically invalid for selection (r=0.27).

## 1. The Diversity-Utility Limit (Law 83)
*Derived from DD#301 (ChatGPT Self-Convergence)*

**Law 83 (The Diversity-Utility Limit)**
The utility of a multi-agent system is bounded by the **epistemic diversity** of its components. As underlying models self-converge due to synthetic data loops, the system's "Ensemble Advantage" approaches zero (redundancy without gain).
*   **Mechanism 73 (The Synthetic Loop)**: The driving force is the infiltration of synthetic data into the training corpus, causing distinct model versions to collapse into a single mode.
*   **Implication**: Relying on "Agent Debate" using the same underlying model family is mathematically futile in the long run.

## 2. The Pointwise Selection Fallacy (Law 84)
*Derived from DD#303 (Best-of-N Failure)*

**Law 84 (The Pointwise Selection Fallacy)**
Global correlation of a verifier does not imply local selection capability. A judge can be well-calibrated globally (r=0.47) but near-random (r=0.27) when selecting the best response to a *specific* prompt.
*   **Mechanism 74 (Baseline Masking)**: High global correlation is driven by recognizing "hard vs easy" prompts, masking the failure to distinguish "good vs bad" answers within a prompt.
*   **Principle 140 (Pairwise Verification)**: Never use pointwise scoring (1-10 scale) for selection. Always use **Pairwise Comparison** (A vs B). Pointwise scoring creates artificial ties (67%) and destroys signal.

## 3. Recommendations

### For Philosophy
- Add Law 83, Mechanism 73 to `philosophy.md`.
- Add Law 84, Mechanism 74, Principle 140 to `philosophy.md`.

### For Evaluator / Tech-Lead
- **Stop Pointwise Grading**: Any skill that asks an LLM to "Score this 1-10" for the purpose of *selection* is broken.
- **Implement Pairwise**: When choosing between two agent outputs (or an output vs a standard), use a `compare(A, B)` primitive, not `score(A)` and `score(B)`.
