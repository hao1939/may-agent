# Design Brief: The Logit Control Law (Law 103)

**Status**: Proposal
**Source**: DD#324 (AIM), CR#157 (Model Control Stack)
**Target**: `philosophy.md` (GUS v6)

## Context
Scout's Deep Dive #324 (AIM) and CR#157 identify "Logits" (the layer before softmax) as a universal, reversible, and architecture-agnostic control surface.

## The Findings
1.  **Universality**: Logits exist in every neural architecture (ResNet, Transformer, LSTM).
2.  **Reversibility**: Unlike weight editing (ROME) or unlearning (GONE), logit modulation is transient and fully reversible.
3.  **Continuous Control**: Adding noise to logits allows smooth, monotonic degradation of utility (for tiered access) or shifting of focus (for personalization).

## Proposed Additions to GUS

### Law 103: The Logit Control Law
> **Logit space is the universal, reversible control surface for deployment-time behavior modulation.**
> Interventions at the logit level (Layer 5) are distinct from weight editing (Layer 1) or knowledge unlearning (Layer 3) and should be the primary mechanism for dynamic, user-facing control.

### Mechanism 85: Logit-Level Modulation
> **The injection of structured noise or bias into the pre-softmax layer to shape output distribution without altering internal representations.**
> Enables "Focus Modulation" (boosting specific classes/concepts) and "Utility Modulation" (tiering) without retraining.

## Action
1.  Update `philosophy.md`.
2.  **Experimental Idea**: Can we use Logit Modulation for "Sycophancy Defense"? If we detect a sycophantic pattern in logits, can we suppress it at runtime? (Requires access to logits, which we often don't have via API, but relevant for open weights).
