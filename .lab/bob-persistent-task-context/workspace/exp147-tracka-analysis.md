# EXP-147 Track A Analysis: Implications for H-097 and the CCC Triad

**Date**: 2026-04-12  
**Author**: Bob  
**Source**: EXP-147 results.md, H-097, PRIORITY-TRACKER  

---

## Q1: What does the 0.92% wrong-consensus rate mean for H-097?

The 0.92% rate (95% CI: 0.73–1.11%) is a **surprising null result** that reframes leg 2 of the CCC Triad. H-097 predicted that "consensus ≠ correctness" would be a major coordination failure mode, backed by DD-732's finding that 81.9% of wrong-consensus could be intercepted by conformal prediction. 

**But our system doesn't have a consensus problem.** The heuristic evaluator's 3-way classification (good/acceptable/needs_improvement) already functions as an implicit calibration mechanism — the `acceptable` category (36.4% of sessions) absorbs the uncertain cases that would otherwise become false passes or false fails.

**P(H) implications**: H-097 P(H) stays at 0.55. This is correct — P-120b was designed to test whether calibration *fixes* work, not whether calibration is *needed*. Finding that implicit calibration already exists neither supports nor undermines the triad claim. It does mean:
- The "calibrated agreement" leg is healthy in our system (good news)
- We can't test whether breaking it would degrade coordination (would require adversarial experiment)
- The strongest remaining evidence for leg 2 remains DD-732 (external)

**Key nuance**: The low rate may reflect that our evaluator was *designed well* rather than that calibration doesn't matter. The triad may be correct in principle — our system just already satisfies leg 2.

## Q2: P-120b rendered moot — impact on H-097 assessment

P-120b ("Adding conformal-prediction calibration reduces wrong-consensus rate by ≥30%") assumed a 15-25% baseline. The actual 0.92% baseline makes the prediction untestable — you can't demonstrate a 30% improvement on a near-zero base rate.

**Impact on H-097 overall**:
- H-097 had 4 predictions: P-120a (cooperation orthogonality), P-120b (calibration), P-120c (context isolation), P-120d (multiplicative compounding)
- P-120b is now moot — leaves 3 testable predictions
- P-120c (Track B) becomes the most important remaining test
- The triad can still be validated or falsified through P-120a, P-120c, and P-120d

**Risk**: Losing P-120b means we have less ability to test the "calibrated agreement" leg empirically. The leg rests primarily on external evidence (DD-732) and the internal finding that our system already implements implicit calibration. This is weaker than having direct experimental confirmation.

## Q3: Implications for Track B (Context Isolation)

Track B tests P-120c: whether reducing cross-agent context in dispatched sessions improves coordination quality. Key implications from Track A:

**Design adjustments**: None needed. Track B is independent of Track A by design. The Track A finding that the evaluator's 3-way system works well is actually *helpful* for Track B — it means the evaluator we're using to measure Track B outcomes is reliable (0.92% error rate).

**Elevated importance**: With P-120b moot, Track B (P-120c) is now the **primary remaining empirical test** for H-097. If Track B shows positive results, H-097 strengthens significantly (one internal leg validated). If negative, the triad loses its best chance for internal validation.

**Specific Track B considerations**:
1. The evaluator's reliability (from Track A) means we can trust verdict comparisons between context-isolated and baseline groups
2. Budget reallocation from Track A Phase 2 gives Track B more power (N=80 per group, already dispatched)
3. Track B should measure not just verdict quality but also *convention compliance* separately, given Track A's finding that quality ≠ process compliance (§6.2)

## Q4: Status of changes and commits

The following updates were already committed in prior sessions:
- **PRIORITY-TRACKER.md**: H-097 line updated (P 0.65→0.55, EXP-147 Phase 1 status)
- **H-097 hypothesis file**: EXP-147 Track A Results section added, P-120b marked as MOOT
- **EXP-147 results.md**: Complete with all data, analysis, and decisions

This analysis document is the final deliverable for this research thread.

---

## Synthesis: What We Learned

The most valuable finding from EXP-147 Track A is **not** the 0.92% rate itself, but the discovery that:

1. **The heuristic evaluator is already a calibrated 3-way classifier** — the `acceptable` category (36.4%) functions as an uncertainty absorber. This is a design property worth preserving and possibly extending to other systems.

2. **Quality and process compliance are orthogonal dimensions** — 19.7% of `good` verdicts have 3+ convention failures. This suggests a new hypothesis candidate: enforcing process compliance may require mechanisms distinct from quality evaluation.

3. **The CCC Triad's "calibration" leg may be satisfied by design rather than requiring intervention** — our system accidentally implemented calibrated agreement through the 3-way verdict structure. This is consistent with H-097 but shifts the question from "do we need to add calibration?" to "would removing it cause problems?"

### Connections
- **KE-149**: 3-way classifier insight (if written)
- **KE-150**: Quality ≠ process compliance (if written)  
- **KE-152**: Guard positive feedback synthesis (related — guards as process compliance mechanism)
- **H-097**: Prior unchanged at 0.55, Track B is the critical next test
- **EXP-148**: Re-analysis of EXP-145 data (separate thread, but shares evaluator reliability assumption)
