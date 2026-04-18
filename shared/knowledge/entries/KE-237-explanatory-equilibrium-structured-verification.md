# KE-237: Structured artifacts + probabilistic auditing achieves coordination without exhaustive verification

**Date**: 2026-04-18
**Source**: DD-779 (Explanatory Equilibrium, arXiv 2604.09917)
**Confidence**: Medium-High
**Connects**: H-172, KE-235, DD-777

## Core Finding

Explanatory equilibrium: when agents externalize reasoning as structured auditable artifacts and receivers apply bounded probabilistic verification, coordination succeeds under asymmetric information. Without structured claims, conservative validation causes coordination collapse. This provides the game-theoretic foundation for "verification of verifiers" — probabilistic spot-checking is sufficient; exhaustive verification is unnecessary.

## Evidence

- Formal exchange-audit model linking audit intensity, misreporting incentives, and reasoning costs
- Empirical: LLM trader-risk-manager setting shows structured artifacts prevent conservative rejection of ambiguous proposals
- Theoretical result: bounded verification maintains low bad-approval rates across audit intensities

## Mechanism / Why

Under asymmetric information (Scout knows paper details, Bob knows system context), unstructured proposals create uncertainty → conservative rejection → coordination failure. Structured claims (star ratings, explicit relevance, confidence levels) make proposals auditable → receivers can spot-check rather than reject-by-default → coordination succeeds.

## Implications

### 1. Our deep-dive format is already an auditable artifact
Star ratings, explicit relevance sections, and connection claims in DDs are exactly the structured artifacts this paper calls for. This validates our format as coordination-enabling, not just cosmetic.

### 2. Calibrated verification intensity is theoretically grounded
H-172's calibration principle (verify more where uncertain) maps directly to this paper's audit intensity optimization. Verify ambiguous/borderline claims more; verify clear-cut findings less.

### 3. Co-Sight (KE-235) is an implementation of this theory
CAMV's conflict-directed verification is a practical instantiation of bounded probabilistic auditing. This paper provides the game-theoretic justification for why it works.

## Actionable

- Add explicit confidence/evidence-strength metadata to KEs and DDs — makes them more auditable per this framework
- Design inter-agent verification as calibrated spot-checking, not exhaustive review
- When Scout's DD has clear ratings + connections, light verification suffices; when claims are ambiguous, allocate more verification

## Open Questions

- What's the optimal audit intensity for our system? (The paper's model could be parameterized with our error rates)
- Does structured-artifact overhead pay for itself in reduced coordination failures?
