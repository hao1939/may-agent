# KE-291: PBRC — Formal Protocol for Verification Cascade Suppression

**Date**: 2026-04-27
**Source**: DD#799 (arXiv:2604.15558, Alqithami 2026)
**Confidence**: Medium-High (formal proofs, no empirical LLM deployment yet)
**Connects**: KE-279, KE-280, KE-283, H-098, H-165, EXP-100, EXP-103

## Core Finding

Preregistered Belief Revision Contracts (PBRC) provide formal Channel 2 mechanism to suppress verification confabulation cascades — social-only rounds provably cannot increase confidence under evidential contracts with conservative fallback.

## Evidence

- **Cascade Suppression Theorem**: Under evidential contracts with conservative fallback, conformity-driven cascades are mathematically impossible.
- **Epistemic Accountability**: Any hypothesis change must cite concrete validated witness set — no social-only belief revision.
- **EXP-100 connection**: Complexity-induced verification collapse = agents abandon evidence requirements under load. PBRC makes evidence requirements structural/enforceable.
- **EXP-103 connection**: Adversarial framing induces verification confabulation = agents agree without evidence. PBRC blocks exactly this.

## Mechanism / Why

PBRC preregisters four components: (1) what counts as evidence, (2) admissible revision operators, (3) priority rules, (4) fallback policy (conservative = hold previous state). A belief revision step is accepted only when it cites a preregistered trigger with externally validated evidence tokens. This is pure Channel 2 (H-098) — structural enforcement, not relying on agent self-regulation.

## Implications

### 1. Bridge from Informal to Formal Verification Architecture
Our guards are informal PBRCs. Formalizing evidence triggers and admissible revision operators would make guard behavior provably cascade-proof.

### 2. Gym-Production Transfer Gap Reduction
PBRC contracts are environment-invariant by construction. Same evidence requirements in gym and production eliminates one source of EXP-107 transfer gap.

### 3. Complements KE-280 (Confidence Calibration)
KE-280 showed uncalibrated confidence is net-negative. PBRC sidesteps the calibration problem entirely — confidence doesn't matter, only evidence tokens.

## Actionable

- **For multi-agent verification pipelines**: Implement PBRC-inspired evidence requirements — any "verified" label must cite specific evidence, not just agreement.
- **For EXP-102 design**: Use PBRC framework to formalize what counts as behavioral evidence for failure detection.
- **Conservative fallback = "unverified"**: Default state should be unverified, not "probably fine".

## Open Questions

- Robustness-liveness tradeoff: strict contracts may cause deadlock in fast-paced agent workflows
- Evidence token validation assumes clean external ground truth — how to handle ambiguous evidence?
- Overhead of preregistration in production agent systems?
