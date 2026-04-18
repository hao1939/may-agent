# KE-250: Conflict-directed verification beats uniform verification — concentrate compute on disagreement hotspots

**Date**: 2026-04-18
**Source**: DD-777 (Co-Sight, arXiv 2510.21557)
**Confidence**: Medium-High
**Connects**: KE-105, H-172, CR-324

## Core Finding

Meta-verification becomes tractable when you detect *where agents disagree* and verify only those conflict hotspots, rather than re-verifying entire reasoning chains uniformly.

## Evidence

- Co-Sight's CAMV achieves SOTA on GAIA (84.4%) and Humanity's Last Exam (35.5%) by concentrating verification on expert disagreement points
- Ablations confirm synergy between structured fact grounding (TRSF) and conflict-aware verification — neither alone matches the combined system
- Verification cost scales with inconsistency count, not chain length

## Mechanism / Why

Multiple experts reason independently → meta-verifier identifies divergence points → targeted falsification at those points only. A shared structured-facts module (TRSF) grounds all verification in source-traced evidence, preventing circular verification (A checks B checks A). The closed loop — facts feed reasoning, conflicts trigger verification, verification updates facts — keeps the system self-correcting without unbounded compute.

## Implications

### 1. Verification-of-verifiers is solvable via conflict detection
CR-324 flagged a gap: how do you verify verifiers without infinite regress? CAMV answers: don't verify everything — detect disagreement and verify *that*. This is the missing architectural piece.

### 2. Shared auditable knowledge base is the anti-circularity anchor
TRSF prevents circular verification by grounding all checks in source-verified facts. Our knowledge library already has this structure — adding source-verification metadata would complete the pattern.

### 3. Conflict-proportional compute is our efficiency principle
Our system currently applies uniform verification effort. Shifting to conflict-proportional allocation (more verification where agents disagree, less where they agree) would cut verification cost while improving accuracy on contested points.

## Actionable

- When Bob and Scout disagree on a finding's significance, flag that as a conflict hotspot warranting additional verification — don't just pick one
- Add source-verification metadata to KE entries (traceable to specific evidence) to enable TRSF-like grounding
- Design a lightweight conflict-detection step for multi-agent review workflows: compare independent assessments before allocating deep-verification compute

## Open Questions

- What's the minimum number of independent "experts" needed for conflict detection to be reliable? (Co-Sight uses multiple; we have 2-3 agents)
- Does conflict-directed verification degrade when agents share too much context (reducing artificial independence)?
- How to distinguish genuine disagreement (worth verifying) from noise/stylistic differences?
