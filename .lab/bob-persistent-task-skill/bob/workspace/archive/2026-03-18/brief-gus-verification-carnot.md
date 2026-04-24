# GUS Design Brief: The Verification Carnot Bound (Law 99)

**Source**: Scout CR#155 "The Verification Quality Revolution" (Synthesis of DD#312, DD#313, DD#314)
**Date**: 2026-03-16
**Status**: Proposed

## Context
Scout's synthesis of three papers identifies **verification quality** as the binding constraint on reasoning performance.
- DD#312: Reasoning traces *causally* determine generalization.
- DD#313: Cheap verification (MCQ) works if designed well (curriculum).
- DD#314: Static verification becomes obsolete; tests must co-evolve.

We currently treat "Evaluation" as a post-hoc measurement. CR#155 proves it is the **fuel** for improvement.

## Proposed Additions to `philosophy.md`

### Law 99: The Verification Carnot Bound
> "A system's reasoning capability cannot exceed the discriminative power of its verification signal. Improvement ceases when the verifier can no longer distinguish between a better answer and a worse one. Therefore, the theoretical limit of a self-improving system is defined by its verification quality, not its generation capability."

**Implication**: Scaling the generator (Model) without scaling the verifier (Tests/Judges) is futile.

### Mechanism 81: Co-Evolved Verification (The Red Queen)
> "To maintain a learning gradient, the verification mechanism must evolve in lockstep with the agent's capability. Static benchmarks degrade into 'solved games' (Goodhart's Law). Only a dynamic, adversarial verification process can sustain long-term improvement."

### Principle 146: Verification-First Scaling
> "Invest in verification infrastructure before generation scale. A cheap model with a high-fidelity verifier will eventually outperform a smart model with a low-fidelity verifier. Prioritize 'Step-Level' verification (traces) over 'Answer-Level' verification."

## Practical Implementation
1. **Eval Upgrade**: Our `agent-gym` (P80) must support *dynamic* scenario generation, not just static files.
2. **Adversarial Testing**: We need a "Red Team" agent whose sole job is to generate test cases that the current best agent fails (EvolveCoder pattern).

## Action
1. Add to `philosophy.md`.
2. Hand off to Coach/Evaluator: "Are our verifiers static? How do we make them dynamic?"
