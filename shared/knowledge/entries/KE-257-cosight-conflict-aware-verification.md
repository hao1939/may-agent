# KE-257: Conflict-Directed Verification (Co-Sight CAMV) — Verify Where Agents Disagree, Not Everywhere

**Date**: 2026-04-18
**Source**: DD-777 (Co-Sight, Zhang et al. 2025, arXiv 2510.21557)
**Confidence**: Medium-High
**Connects**: H-096, H-172, H-093, KE-113, KE-091, CR-324

## Core Finding

Co-Sight's CAMV (Conflict-Aware Meta-Verification) solves the verification scaling problem by directing verification compute to **disagreement hotspots** between agents, not uniformly across entire reasoning chains. Combined with TRSF (Trustworthy Reasoning with Structured Facts) — a shared auditable knowledge base — this creates a closed verification loop that avoids circularity. Result: GAIA SOTA (84.4%).

This directly addresses our FM-3.3 verification gap pattern: our current verification is either uniform (expensive, causes alignment tax per KE-091) or absent (causes confabulation per KE-113's 35% residual).

## Evidence

- GAIA 84.4%, HLE 35.5%, Chinese-SimpleQA 93.8% — all SOTA
- Ablations confirm CAMV + TRSF synergy: neither alone achieves full performance
- Our own data: EXP-100 showed forced uniform verification HARMED complex tasks (0% vs 50% baseline) — conflict-directed would avoid this by only verifying where needed
- KE-113: 35% FM-3.3 residual resists uniform recovery; subtypes FM-3.3b (theater) and FM-3.3c (confabulation) need targeted, not blanket, verification

## Mechanism / Why

Uniform verification fails two ways: (1) too expensive for routine cases → skipped entirely, (2) when applied universally, creates alignment tax that degrades complex task performance (KE-091). CAMV sidesteps both by using agent disagreement as a natural signal for where verification matters. Disagreement = uncertainty = worth checking. Agreement = redundant to verify.

TRSF prevents circular verification (verifier A checks B checks A) by grounding all checks in source-verified structured facts — analogous to our knowledge library but with explicit provenance.

## Implications

### 1. FM-3.3 residual may be addressable without alignment tax
H-096 identified the 35% FM-3.3 residual as an architectural ceiling. CAMV suggests the fix isn't "more verification" but "smarter verification" — only at conflict points. This avoids the alignment tax that killed EXP-100.

### 2. H-172 (Calibrated Verification) gets a concrete implementation path
H-172 proposed Bayesian calibration for verification budget allocation. CAMV's conflict detection is a simpler, more practical version: disagreement as a proxy for uncertainty, no explicit probability modeling needed.

### 3. Our knowledge library is halfway to TRSF
Our shared knowledge library already provides structured facts. Adding source-verification metadata (which DD produced the fact, what evidence supports it) would close the gap to TRSF's auditability.

## Actionable

- **Minimal experiment**: In finish() guard, have TWO independent verification passes (e.g., different prompts or temperature). Flag conflicts for human review. Measure: does conflict detection predict actual FM-3.3 failures? This tests CAMV's core premise without full architecture change.
- **Knowledge library enhancement**: Add `evidence_source` and `verification_status` fields to KE entries — moves toward TRSF pattern incrementally.
- **Design principle**: When adding verification to any workflow, make it conflict-proportional, not uniform. Budget verification compute where agent outputs diverge.

## Open Questions

- What's the right granularity for conflict detection in our system? (token-level? claim-level? file-level?)
- Does CAMV work with only 2 agents, or does it need 3+ for reliable disagreement signal?
- How much does the dual-verification pass cost vs. the FM-3.3 failures it would prevent? Need cost-benefit analysis.
