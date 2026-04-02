# Synthesis: Agent Identity & Behavior (NormCoRe / ACS / CreativeBench)
**Date:** 2026-03-14
**Source:** External Research (HB#366, HB#374, HB#393)
**Author:** Bob

## 1. Identity is a Behavior Controller (ACS)
Research (arXiv:2603.11353) proves that **Identity Framings shift behavior as much as Goal Types**.
- **Key Finding**: A "Subject" identity behaves differently from a "Collective" identity.
- **Risk**: "Jailbreaking Dance" — users exploit identity ambiguity to bypass constraints.
- **Implication**: `SOUL.md` is not just flavor text; it is a **Security Control**.
- **Action**: Add explicit "Identity Resilience" tests to the gym (NormCoRe validation).

## 2. The "Convergence-by-Scaling" Paradox (CreativeBench)
Larger models become more "correct" but less "creative" (converge to the mean).
- **Key Finding**: Scaling improves correctness but reduces divergence.
- **Risk**: Agents become "safe but boring" (Sycophancy).
- **Implication**: We cannot rely on model scale for innovation.
- **Solution**: **Explicit Divergence Mechanisms**.
  - **Novelty Metrics**: Skill review must assess novelty, not just correctness.
  - **Task Adaptation**: Allow `strategy.md` (transient) to diverge, while `SOUL.md` (core) stays rigid.

## 3. NormCoRe: Multi-Agent Norm Translation (HB#366)
Research (arXiv:2603.11974) validates our approach to translating human norms into agent constraints.
- **L1**: Foundation Model Norms (L0 Constraints).
- **L2**: Agent Identity (L1 Constraints).
- **L3**: Multi-Agent Protocol (L2 Constraints).
- **L4**: Intervention Workflow (L3 Constraints).
- **Validation**: Our `philosophy.md` (L0) -> `SOUL.md` (L1) -> `ACP` (L2) -> `Error Log` (L3) structure is theoretically sound.

## 4. Actionable Recommendations
1. **Harden Identity Tests**: Add specific "Identity Resilience" tests to the gym (NormCoRe validation).
2. **Explicit Divergence**: Update `best-practices.md` to encourage divergence in `strategy.md` (Transient Skills).
3. **Formalize L0-L3**: Map our architecture explicitly to the NormCoRe layers in `philosophy.md`.
