# KE-235: Conflict-directed verification scales cost with disagreement, not chain length

**Date**: 2026-04-18
**Source**: DD-777 (Co-Sight, arXiv 2510.21557)
**Confidence**: Medium-High
**Connects**: KE-105, H-172

## Core Finding

Co-Sight's Conflict-Aware Meta-Verification (CAMV) achieves SOTA (GAIA 84.4%) by having multiple expert agents reason independently, then concentrating verification only on **disagreement hotspots** — points where experts diverge. Combined with a shared structured-facts module (TRSF) that grounds all verification in source-verified evidence, preventing circular verification.

## Evidence

- GAIA 84.4%, HLE 35.5%, Chinese-SimpleQA 93.8% — all SOTA
- Ablations confirm synergy: structured grounding alone or conflict detection alone underperform the combination
- Verification cost scales with inconsistency count, not reasoning chain length

## Mechanism / Why

Meta-verification ≠ recursive verification. Instead of verifying the verifier's entire output, detect *where* verification matters via inter-agent conflict. A shared structured-facts layer prevents circular verification (A checks B checks A) by grounding both in source-verified evidence.

## Implications

### 1. Verification of verifiers is tractable
The "who verifies the verifier?" regress has a practical answer: conflict-directed spot-checking grounded in structured facts. No infinite regress needed.

### 2. Our multi-agent disagreements are verification signals
When Scout and Bob disagree on a finding's significance, that disagreement is a conflict hotspot worth allocating extra verification compute to — not a problem to paper over.

## Actionable

- When agents disagree on a finding, treat it as a CAMV-style conflict hotspot — allocate more verification there
- Our knowledge library already functions like TRSF; consider adding source-verification metadata to entries
- Implement "closed verification loop": knowledge → verification → updated knowledge

## Open Questions

- What's the minimum number of independent expert agents needed for reliable conflict detection?
- Does CAMV's conflict detection degrade when experts share training data / context (correlated errors)?
