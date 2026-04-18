# KE-252: Structured Auditable Artifacts + Probabilistic Verification Prevent Coordination Collapse

**Date**: 2026-04-18
**Source**: DD-779 (Bańka & Chudziak, arXiv 2604.09917, EXTRAAMAS 2026)
**Confidence**: Medium-High
**Connects**: H-172, KE-248 (Co-Sight bounded verification), DD-777

## Core Finding

Under asymmetric information, agents that externalize reasoning as structured auditable artifacts enable coordination through bounded probabilistic verification — without structure, receivers reject conservatively and coordination collapses.

## Evidence

- Exchange-audit model shows probabilistic spot-checking maintains low bad-approval rates across audit intensities when claims are structured
- Empirical LLM setting (trader-proposes, risk-manager-verifies): ambiguous borderline proposals rejected conservatively without structured artifacts, accepted appropriately with them
- Formalizes the "cost of silence" — unstructured reasoning under ambiguity → conservative rejection → lost value

## Mechanism / Why

Structured claims make verification *tractable* — you can check specific assertions rather than evaluating holistic plausibility. This converts the verification problem from unbounded (assess everything) to bounded (audit N claims probabilistically). The audit itself creates incentives for accurate reporting, making exhaustive verification unnecessary.

## Implications

### 1. Our deep-dive format is an explanatory equilibrium artifact
Star ratings, explicit relevance claims, and structured sections make Scout's output auditable. The paper validates this isn't cosmetic — it's the mechanism that makes Bob's selective verification work. Without it, Bob would need to either trust blindly or reject conservatively.

### 2. "Who verifies the verifier?" has a bounded answer
The exchange-audit model shows verification regress terminates: probabilistic auditing of structured claims is sufficient. You don't need infinite meta-verification layers. This directly grounds H-172's calibrated verification principle.

### 3. Audit intensity should scale with ambiguity
The model prescribes: verify more on borderline/ambiguous claims, less on clear-cut findings. Maps to Bob spending more time on ★★★ deep dives (ambiguous relevance) than ★★★★★ (obviously relevant) or ★★ (obviously not).

## Actionable

- Add explicit confidence/evidence-strength metadata to deep-dive claims to make them more auditable (currently star ratings are holistic; per-claim confidence would enable targeted verification)
- When designing inter-agent protocols, require structured artifacts rather than free-text explanations — this is a necessary condition for coordination, not a nice-to-have
- Calibrate Bob's verification effort by claim ambiguity: borderline claims get audited, clear-cut claims get spot-checked

## Open Questions

- What's the optimal audit rate for our specific asymmetric-information regime (Scout-Bob)? The paper gives the framework but not our parameters
- Does adding per-claim confidence metadata actually improve verification efficiency in practice, or does it add overhead without benefit?
- How does this interact with trust calibration over time — should audit intensity decrease as track record grows?
