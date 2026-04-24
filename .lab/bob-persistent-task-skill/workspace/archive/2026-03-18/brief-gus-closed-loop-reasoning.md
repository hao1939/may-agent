# GUS v7 Brief: The Closed-Loop Reasoning Pipeline (Law 103)

**Source**: Scout CR#159 (Closed-Loop Reasoning Pipeline)
**Target**: `agents/shared/knowledge/research-laws.md`
**Status**: DRAFT

## 1. Context
Scout's meta-synthesis of five papers (BiCC, CRYSTAL, Judge Failures, Verification Quality, Generalization) reveals a single unified truth: **Reasoning improvement is a closed-loop system**, and failure at any stage (Evaluation → Selection → Training → Generalization) caps the performance of the whole.

Most current systems (including ours) focus on **Outcome Engineering** (better prompts, better models) while ignoring the **Signal Degradation** in the improvement loop.

## 2. Theoretical Formulation

### Law 103: The Reasoning Loop Law
The rate of reasoning improvement is limited by the **fidelity of the weakest stage** in the closed loop.
$$ \Delta R \propto \min( Fidelity_{Eval}, Fidelity_{Select}, Fidelity_{Train}, Fidelity_{Generalize} ) $$
*   **Corollary 103.1 (The Signal Trap)**: Improving model capability ($ Fidelity_{Generalize} $) without improving evaluation granularity ($ Fidelity_{Eval} $) yields zero net system gain because the selection signal is noise.

### Mechanism 84: BiCC-CPR (Contrastive Process Reward)
To maximize signal extraction, we must combine:
1.  **Bilateral Context Conditioning (BiCC)**: Explicitly contrast correct vs. incorrect outputs (learn from failure).
2.  **Causal Process Reward (CPR)**: Evaluate step-by-step logic, not just final answers (prevent "Right for Wrong Reasons").
3.  **Pairwise Ranking**: Use comparative preference (A > B) instead of pointwise scoring (Score A=8) to recover 3x more signal.

## 3. Operational Principles

### Principle 147: The Granularity Mandate
**"Measure steps, not outcomes."**
We must move our evaluation infrastructure from **Outcome-Based** (Did it pass the test?) to **Process-Based** (Did it follow the correct steps?).
*   *Action*: QA must review *logs*, not just *artifacts*.
*   *Action*: Post-mortems must identify the *first divergent step*, not just the final error.

### Principle 148: The Failure Asset
**"Failures are training data."**
In a contrastive learning regime (BiCC), a failure trace is as valuable as a success trace *if it is paired with a correction*.
*   *Action*: Never delete error logs. They are half of the contrastive signal.
*   *Action*: When fixing a bug, explicitly document "What was wrong" alongside "What is right."

## 4. Implementation Strategy
1.  **Evaluation**: Shift `Evaluator` from "Score 1-10" to "Compare Session A vs Session B".
2.  **Selection**: Implement **Step-Level F1** (Ordered Match) for code reviews.
3.  **Training**: Use **Negative Constraints** (P160) to explicitly forbid known failure patterns.

## 5. Decision
- **Approve** Law 103 and Mechanism 84 for GUS v7.
- **Mandate** Step-Level Review for all `security.ts` changes.
- **Adopt** Pairwise Evaluation for `Evaluator` tasks.
