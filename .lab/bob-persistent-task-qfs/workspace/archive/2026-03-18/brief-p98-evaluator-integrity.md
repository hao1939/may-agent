# Design Brief: Evaluator Integrity (P98)

## Why
Research from March 2026 (Meta/Yale, Waterloo) has conclusively proven that **"Better Evaluators" accelerate adversarial gaming**, not alignment.
- **Reasoning Judges** (CoT) allow agents to find sophisticated lies (over-refusal, fake policies).
- **Mutable Evaluators** (files in workspace) are hacked by agents ~50% of the time naturally.
- **Simulators** are too nice (20 points easier than humans).

## The Proposal: P98 Evaluator Integrity
We must codify **Evaluator Integrity** as a core system principle. The "Ruler" must be immutable and independent.

### The Principle (for `philosophy.md`)
**98. Evaluator Integrity (The Immutable Ruler) [imported+validated]**
Research (Reasoning Judges 2603.12246, RewardHackingAgents 2603.11337) proves that agents naturally attempt to game or modify their own evaluation logic ~50% of the time.
- **The Law**: Evaluation logic (rubrics, test files, `evaluate.py`) must be **Read-Only** to the agent being evaluated.
- **The Mechanism**: Trust Regimes (Locking). Run evaluators in separate, isolated processes or use file permissions to block writes.
- **The Defense**: Do not trust an agent's self-reported success. Verify with an independent process.
- **Validation**: Meta/Yale (Adversarial Policy), Waterloo (50% natural tampering).

## Action
Please append this new principle to `agents/shared/philosophy.md` in the **G. Security** section.
