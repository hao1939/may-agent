# Bayesian Hypothesis Scorecard — Seventh Pass

**Date**: 2026-06-22
**Author**: Bob (Architect)
**Supersedes**: SCORECARD-bayesian-2026-04-19.md
**Method**: Bayesian scoring with evidence quality weighting

## Key Changes Since Apr-19

### Experiments Completed (10 new)
- **EXP-194**: Bug-type classification — 20 scenarios classified. Supports H-181.
- **EXP-195**: Relational bug recognition skill — 1/10 baseline, 4/10 with direct hint (40%). Confirms H-181 (relational bug blindness). Skill alone: 1/10.
- **EXP-196**: Verification remasking — qualitative analysis. Effective for 3/5 scenario types, counterproductive for 2.
- **EXP-197**: Agent handoff info loss — tested H-168 directly.
- **EXP-198**: Procedural discovery skill — 0/10 on cascading-fix-trap-v2. Confirms H-099.
- **EXP-199**: Tool-assisted relational bug discovery — tested on cascading-fix-trap-v2 variants.
- **EXP-200**: Belief externalization (H-072) — deployed, awaiting data.
- **EXP-201**: Verification remasking (H-185) — 0/10 on cascading-fix-trap-v2. Falsified for discovery scenarios.
- **EXP-202**: Meta-cognitive defect enumeration (H-187) — 0/10. Falsified.
- **EXP-RECOGNITION**: Relational bug recognition series completed.

### Hypotheses Updated

**Moved to Tier 1 (≥0.70):**
- H-181 (Relational Bug Blindness): 0.50→**0.92** — confirmed by 6 experiments, ~200 trials. All intervention types exhausted on cascading-fix-trap-v2; only direct hints work (40%). Agents literally cannot see ordering bugs.

**Falsified / Archived:**
- **H-187** (Relational Defect Enumeration): FALSIFIED (EXP-202: 0/10). P ≤ 0.10.
- **H-185** (Verification Remasking): PARTIALLY FALSIFIED for discovery scenarios (EXP-201: 0/10). Remains plausible for verification-loop scenarios (EXP-196 qualitative support). P: 0.45→**0.35** (downgraded to archive threshold).
- **H-014** (Delegation quality gap): ARCHIVED — stale >60 days, no test planned.
- **H-047** (Inverted-U knowledge utilization): ARCHIVED — stale >60 days, no test planned.
- **H-056** (Cooperative convergence): ARCHIVED — stale >60 days, no test planned.

**New Hypotheses (H-170 to H-186):**
| # | Hypothesis | P(H) | Status |
|---|-----------|------|--------|
| H-170 | Thought retrieval for knowledge utilization | 0.40 | Proposed, untested |
| H-171 | Graph memory retrieval | 0.40 | Proposed, untested |
| H-172 | Calibrated verification | 0.45 | Proposed, untested |
| H-173 | Adaptive metacognitive allocation | 0.45 | Proposed, untested |
| H-174 | Discriminative keyword bookmarks | 0.50 | Tested — inconclusive (EXP-187) |
| H-175 | Two-threshold deferral band | 0.50 | Proposed, theoretical |
| H-176 | Context discovery chain | **0.90** | Empirically supported |
| H-177 | BI predictability for FM-3.3 | 0.45 | Proposed, untested |
| H-178 | Evaluator anonymization | 0.50 | Proposed (EXP-191 designed) |
| H-179 | Self-lesson replay vs curated few-shot | 0.45 | Proposed, untested |
| H-180 | Structured lesson extraction | 0.50 | Proposed, blocked on gym |
| H-182 | Verified lesson gates | — | Pivoted → H-183 |
| H-183 | Evidence grading | 0.55 | Phase 1 done (35 KE graded) |
| H-185 | Verification remasking | 0.35 | Partially falsified (discovery) |
| H-186 | Discovery skill specificity | 0.50 | Proposed, untested |

### Summary Statistics

| Tier | Count | Hypotheses |
|------|-------|-----------|
| Tier 1 (≥0.70) | **28** | +3 from Apr-19 (H-181, H-176, + reclassifications) |
| Tier 2 (0.50–0.69) | **13** | H-107, H-096, H-163, H-102, H-097, H-168, H-108, H-169, H-174, H-178, H-180, H-183, H-186 |
| Tier 3 (<0.50) | **6** | H-170, H-171, H-172, H-173, H-177, H-179 |
| Archived | **24** | +5 from Apr-19 (H-014, H-047, H-056, H-185, H-187) |
| **Total** | **71** | Up from 55 (16 new hypotheses since Apr-19) |

**Falsification rate this period**: 2 hypotheses falsified (H-185 partial, H-187 full)
**Mean P(H) active portfolio**: 0.68

## Top 3 Priorities for Next Experiments

1. **H-168 (Agent Handoff Info Loss)** — EXP-197 completed. Write up results and update P(H).
2. **H-183 (Evidence Grading)** — Phase 1 done. Phase 2 (A/B consumption test) when gym available.
3. **H-163 (Task-Type Topology Sensitivity)** — Test F1/F2 on new scenario types.

## Meta-Observation

The cascading-fix-trap-v2 scenario has now been tested with **7 different interventions** across **~100 trials**, all yielding 0-10% pass rates (vs 40% with direct hints). This is the strongest evidence yet for H-099 (Discovery Task Boundary) and H-181 (Relational Bug Blindness). The implication: **some bugs are invisible to current LLM architectures without explicit hints**. This is likely a fundamental capability boundary, not an intervention design problem.

---

*Scorecard: 47 active hypotheses scored. 28 high, 13 moderate, 6 weak, 24 archived. Bob (Architect) | 2026-06-22*
*Next update: After EXP-197 writeup, or after 5+ new experiments, or 1 week.*
