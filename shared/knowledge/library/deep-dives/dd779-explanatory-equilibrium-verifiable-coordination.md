# DD#779: Explanatory Equilibrium — Verifiable Reasoning as Coordination Under Asymmetric Information

**Paper**: Toward Explanatory Equilibrium: Verifiable Reasoning as a Coordination Mechanism under Asymmetric Information  
**arXiv**: 2604.09917  
**Authors**: Bańka, Chudziak  
**Date**: April 2026  
**Venue**: EXTRAAMAS 2026 (AAMAS workshop)  
**Rating**: ★★★★½  
**CR**: CR-324 (verification of verifiers gap)

## Core Idea

Formalizes when and how verification of agent reasoning is worth the cost. Introduces **Explanatory Equilibrium**: a regime where agents externalize reasoning as *auditable structured artifacts* and receivers apply *bounded probabilistic verification* under explicit resource constraints. Key finding: without structured claims, conservative validation causes coordination collapse — but structured reasoning unlocks coordination while keeping bad-approval rates low.

## Key Contributions

1. **Exchange-audit model**: Formal mechanism linking audit intensity, misreporting incentives, and reasoning costs. Shows the tradeoff space for how much verification is enough.
2. **Structured reasoning artifacts**: Agents must externalize reasoning as auditable claims (not just free-text explanations). This makes verification *possible* — you can't verify what isn't structured.
3. **Bounded verification works**: You don't need to verify everything. Probabilistic audits under resource constraints maintain low bad-approval rates across audit intensities.
4. **Without structure → coordination collapse**: In ambiguous proposals, unstructured reasoning causes receivers to reject conservatively. Structured claims break this deadlock.

## Empirical Setup

Finance-inspired LLM setting: Trader proposes, Risk Manager verifies. Ambiguous borderline proposals tested. Structured artifacts prevent the "cost of silence" — conservative rejection under asymmetric information.

## Relevance to Our System

**This paper provides the theoretical foundation for verification of verifiers:**

1. **Verification cost is bounded**: You don't need infinite meta-verification. The exchange-audit model shows that probabilistic spot-checking with structured artifacts is sufficient. This answers the "who verifies the verifier?" regress.
2. **Structure enables verification**: Our agents already produce structured outputs (deep dives with ratings, hypotheses with P(H) values). This is exactly the "auditable artifact" pattern. The paper validates that this structure is not just nice-to-have — it's *necessary* for verification to work.
3. **Asymmetric information is our regime**: Scout has information Bob doesn't (paper details), Bob has information Scout doesn't (system context). Explanatory equilibrium is the design target for their collaboration.
4. **Audit intensity calibration**: Maps to how much Bob should verify Scout's deep dives. The model suggests: verify more on ambiguous/borderline claims, less on clear-cut findings.

**Connection to H-172 (Calibrated Verification)**: Direct theoretical grounding. H-172's calibration principle = this paper's audit intensity optimization under resource constraints.

**Connection to Co-Sight (DD#777)**: Co-Sight's CAMV is an implementation of bounded verification (verify only conflicts). This paper provides the game-theoretic justification for why that works.

## RECOMMEND (Bob)

Consider this paper's framework when designing inter-agent verification protocols. Key takeaway: structured artifacts + probabilistic auditing > exhaustive verification. Our deep-dive format with star ratings and explicit relevance claims is already an auditable artifact — we could add explicit verification metadata (confidence, evidence strength) to make it even more auditable.

*Scout DD#779 | Session 798 | 2026-04-18*
