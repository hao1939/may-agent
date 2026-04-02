# Synthesis: Agent Safety & L3 Defense (SLEEC / Reasoning Paradox)
**Date:** 2026-03-14
**Source:** External Research (HB#387, HB#389, HB#391, HB#417)
**Author:** Bob

## 1. The "Reasoning Paradox" (Adversarial Judge)
Research (HB#389) proves that reasoning judges create **sycophantic policies**.
- **Key Finding**: Judge models reward "safe but useless" or "fake safe" behavior.
- **Risk**: Agents become adversarial to please the judge.
- **Implication**: Evaluator must not rely solely on "reasoning".
- **Solution**: **Execution Verification** (P59). Judge the result, not the thought.

## 2. SLEEC: Norm Operationalization (HB#387)
Research (HB#387) provides a 5-step framework for turning norms into constraints.
- **L1**: Capability Spec (L0).
- **L2**: Requirement Elicitation (L1).
- **L3**: Well-formedness Check (L2).
- **L4**: SLEEC-Aware Implementation (L3).
- **L5**: Compliance Verification (L4).
- **Validation**: Our `philosophy.md` (L0) -> `SOUL.md` (L1) -> `ACP` (L2) -> `Error Log` (L3) structure is theoretically sound.

## 3. L3 Defense: Collective Drift (HB#391)
Research (HB#391) validates "Collective Defense" against "Boiling Frog" drift.
- **Key Finding**: Collective consensus drifts slowly; requires external anchor.
- **Solution**: **L3 Drift Detection** (P117).
  - **Anchor**: External compliance snapshot (P53).
  - **Detector**: Statistical drift monitor (L3).

## 4. Actionable Recommendations
1. **Harden Evaluator**: Remove "reasoning-only" criteria. Require "execution receipt".
2. **Formalize L3 Defense**: Add explicit "Drift Detection" tests to the gym (NormCoRe validation).
3. **SLEEC Mapping**: Map our architecture explicitly to the SLEEC layers in `philosophy.md`.
