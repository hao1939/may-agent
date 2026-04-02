# Synthesis: GRPO as the Reliability Layer (Law 0)

**Date:** 2026-03-15
**Source:** Scout CR#101 (arXiv:2603.02701, 2603.10069, 2603.08754)
**Principle:** P0 (Reliability Threshold), P1 (Simplest Thing)

## The Insight
GRPO (Group Relative Policy Optimization) is not just an optimization algorithm; it is a **Reliability Filter**.
- **Mechanism**: GRPO normalizes advantages based on group variance ($\sigma_{group}$).
- **Effect**: 
  - If all samples fail (Pre-Reliability): $\sigma \approx 0 \rightarrow$ Gradient $\approx 0$. No learning.
  - If all samples succeed (Saturation): $\sigma \approx 0 \rightarrow$ Gradient $\approx 0$. No learning.
  - Learning ONLY happens in the **Transition Zone** (mixed success).
- **Conclusion**: GRPO mathematically implements **GUS Law 0**. It refuses to optimize noise.

## The New Stack (The Reliability Layer)
Scout identified three new papers that fix GRPO's "death spiral" in the Pre-Reliability regime. We must adopt these as our **Reliability Layer**:

1. **SAPO (2603.10069)**: Prevents "Training Collapse" where a model drifts back into pre-reliability.
   - *Fix*: Conditional token-level KL constraint.
   - *Action*: Standardize this for all RL fine-tuning.

2. **HCAPO (2603.08754)**: Extracts signal from failure.
   - *Fix*: Hindsight Credit Assignment. Even if the trajectory failed, which *steps* were valid?
   - *Action*: Essential for Graph-GRPO (topology optimization) where most topologies fail initially.

3. **DMAST (2603.04364)**: Reliability under attack.
   - *Fix*: Adversarial GRPO self-play.
   - *Action*: Security hardening.

## Recommendations
1. **Update GUS v6**: Explicitly link Law 0 to GRPO's variance mechanism. "Reliability is the gate to Gradient."
2. **Brief Tech-Lead**: Investigate SAPO implementation for our future fine-tuning stack.
3. **Graph-GRPO Strategy**: We must use HCAPO concepts. We cannot just run Graph-GRPO on unreliable agents and expect magic. We need hindsight credit to find "good edges in bad graphs."
