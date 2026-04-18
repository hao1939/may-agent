# KE-226: Verification regress is solvable — conflict-directed auditing + structured artifacts suffice

**Date**: 2026-04-18
**Source**: DD-777 (Co-Sight), DD-779 (Explanatory Equilibrium)
**Confidence**: Medium-High
**Connects**: KE-223 (GLEAN calibration), H-172 (calibrated verification), KE-105 (verification orchestration stack)

## Core Finding

The "who verifies the verifier?" regress has two complementary solutions that together make meta-verification tractable:

1. **Conflict-directed verification** (Co-Sight/CAMV): Don't verify everything — detect where agents *disagree* and concentrate verification compute on those conflict hotspots. Cost scales with inconsistency, not chain length.
2. **Structured artifacts + probabilistic auditing** (Explanatory Equilibrium): When agents externalize reasoning as auditable structured claims, bounded spot-checking maintains low bad-approval rates. Without structure, conservative rejection causes coordination collapse.

Together: structure makes verification *possible*, conflict-detection makes it *efficient*.

## Evidence

- Co-Sight achieves SOTA on GAIA (84.4%) and HLE (35.5%) via CAMV + TRSF (structured facts)
- Ablations confirm synergy — neither component alone matches combined performance
- Explanatory Equilibrium's exchange-audit model formally proves bounded verification sufficient under structured claims
- DD-779 shows unstructured reasoning → coordination collapse in ambiguous cases (empirically demonstrated in finance-domain LLM setting)

## Mechanism / Why

Verification regress fails when treated as recursive (A checks B checks A). Two design moves break the cycle:
- **Grounding to source-verified facts** (TRSF) prevents circularity — both verifier and verified ground to shared evidence, not each other
- **Conflict as signal** — disagreement among independent reasoners is a reliable proxy for uncertainty, making verification allocation tractable without omniscient meta-knowledge

## Implications

### 1. Our FM-3.3 guards are conflict-oblivious
Current verification guards apply uniformly. CAMV suggests: verify more where agents disagree or where claims are borderline, less where consensus exists. This would reduce alignment tax (KE-091) on clear-cut tasks while maintaining rigor on ambiguous ones.

### 2. Our structured output format is already an "auditable artifact"
Deep dives with star ratings, hypotheses with P(H), KEs with confidence levels — these are the structured claims DD-779 says are *necessary* for verification to work. We're doing this right already. Enhancement: add explicit evidence-strength metadata per claim.

### 3. Calibrated verification (H-172) has formal backing
H-172's principle "verify proportional to uncertainty" is now grounded in both an implementation (CAMV) and a theory (explanatory equilibrium). This strengthens the case for making verification intensity dynamic.

## Actionable

- **Inter-agent verification**: When Scout and Bob rate a finding differently, that's a conflict hotspot — route to deeper review. When they agree, lighter verification suffices.
- **Guard redesign direction**: Move FM-3.3 guards from uniform checking to conflict-proportional checking. High-confidence routine outputs get lighter verification; novel/borderline claims get heavier.
- **Knowledge library enhancement**: Add source-verification metadata to KE entries (evidence strength per claim) to enable downstream auditing — mirrors TRSF's structured facts.

## Open Questions

- What's the right conflict-detection threshold for our system? CAMV uses expert disagreement, but we often have single-agent outputs — need proxy signals for internal uncertainty.
- Does probabilistic auditing degrade over time if agents learn the audit pattern? DD-779's model assumes static incentives.
