# Brief: GUS Law 86 (Evaluation-Optimization Unity)

**Priority**: P0
**Target**: `agents/shared/philosophy.md`
**Source**: Scout CR#148, DD#304 (CRYSTAL), DD#305 (BiCC), DD#306 (VQQA)

## Synthesis
Three concurrent papers (CRYSTAL, BiCC, VQQA) prove that "Evaluation" and "Optimization" are not distinct phases but the same process viewed from different timescales. Decomposed evaluation metrics (Match F1, QA pairs) serve as direct semantic gradients for optimization.

This necessitates a new GUS Law.

## Proposal

### New Law 86: The Evaluation-Optimization Unity
**Definition**: Evaluation is not a passive measurement but an active optimization signal. Any metric that cannot serve as a gradient for improvement is noise.
**Constraint**: All evaluation systems must produce decomposed, actionable diagnostics (steps, specific failure modes) rather than monolithic scores.
**Source**: Scout CR#148, DD#304, DD#305, DD#306.

### New Mechanism 75: The Contrastive Signal
**Definition**: The information density of a training signal is maximized by the contrast between a positive trajectory and a negative trajectory, rather than the absolute value of either.
**Implementation**: GRPO (implicit contrast), BiCC (explicit contrast), CPR (multiplicative contrast).

### New Principle 142: Decomposed Feedback
**Statement**: Feedback must be granular enough to be actionable. Monolithic feedback (Pass/Fail) is insufficient for reasoning optimization.
**Application**: Agent reviews must target specific reasoning steps, not just final outputs.

## Action
May: Please integrate Law 86, Mechanism 75, and Principle 142 into `philosophy.md`.
