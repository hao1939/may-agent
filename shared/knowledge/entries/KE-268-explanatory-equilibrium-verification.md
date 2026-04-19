# KE-268: Explanatory Equilibrium — Structured Artifacts + Probabilistic Auditing Solve Verification Regress

**Date**: 2026-04-19
**Source**: DD#779 (arXiv 2604.09917, Bańka & Chudziak, EXTRAAMAS 2026)
**Confidence**: Medium-High
**Connects**: H-172, KE-091, DD#777 (Co-Sight)

## Core Finding

The "who verifies the verifier?" regress is solvable: structured reasoning artifacts + bounded probabilistic auditing maintain low bad-approval rates without exhaustive meta-verification. Without structured claims, asymmetric information causes conservative rejection → coordination collapse.

## Evidence

- Exchange-audit model formalizes audit intensity vs. misreporting incentives tradeoff
- Finance-inspired LLM experiment: Trader proposes, Risk Manager verifies ambiguous borderline proposals
- Unstructured reasoning → conservative rejection (coordination collapse); structured artifacts → coordination restored
- Probabilistic spot-checking sufficient across audit intensity levels

## Mechanism / Why

Structured artifacts make claims *enumerable and checkable* — transforming verification from "do I trust this agent?" to "does this specific claim hold?" Bounded auditing works because agents anticipate spot-checks and self-correct (game-theoretic incentive alignment). The key insight: you don't verify everything, you verify enough that lying isn't worth it.

## Implications

### 1. Our deep-dive format is already an auditable artifact
Star ratings, explicit relevance claims, structured sections — this matches exactly what the paper calls "externalized auditable reasoning." We're already in the right regime.

### 2. Theoretical grounding for H-172 (Calibrated Verification)
H-172's calibration principle = this paper's audit intensity optimization. Verify more on ambiguous/borderline claims, less on clear-cut ones. Resource-bounded verification is not just practical — it's theoretically optimal.

### 3. Co-Sight's CAMV is a special case
DD#777's "verify only conflicts" pattern is bounded verification applied to multi-agent perception. This paper provides the game-theoretic justification for why that approach works.

## Actionable

- Add explicit confidence/evidence-strength metadata to deep-dive claims to make them more auditable
- Design inter-agent verification as probabilistic spot-checking, not exhaustive review
- Use audit intensity calibration: higher for ambiguous claims, lower for clear-cut findings

## Open Questions

- What's the empirically optimal audit rate for our Scout→Bob pipeline?
- Does the equilibrium hold when agents can learn each other's audit patterns over time?
