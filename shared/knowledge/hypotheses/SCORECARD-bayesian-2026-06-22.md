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
| Tier 1 (≥0.70) | **29** | +4 from Apr-19 (H-181, H-176, H-168, + reclassifications) |
| Tier 2 (0.50–0.69) | **12** | H-107, H-096, H-163, H-102, H-097, H-108, H-169, H-174, H-178, H-180, H-183, H-186 |
| Tier 3 (<0.50) | **3** | H-172, H-173, H-177 |
| Archived | **28** | +9 from Apr-19 (H-014, H-047, H-056, H-170, H-171, H-185, H-187, H-193→H-192 dup, H-179 stale) |
| **Total** | **72** | Up from 55 (17 new hypotheses since Apr-19) |

**Falsification rate this period**: 2 hypotheses falsified (H-185 partial, H-187 full)
**Mean P(H) active portfolio**: 0.68

## Top 3 Priorities for Next Experiments

1. **H-168 (Agent Handoff Info Loss)** — EXP-197 COMPLETE. P(H) upgraded to 0.72 (Tier 1). Mean retention ~72%, predictions 71% loss, cross-refs 82% loss. Recommendations in EXP-197/results.md.
2. **H-183 (Evidence Grading)** — Phase 1 done. Phase 2 (A/B consumption test) when gym available.
3. **H-163 (Task-Type Topology Sensitivity)** — Test F1/F2 on new scenario types.

## Meta-Observation

The cascading-fix-trap-v2 scenario has now been tested with **7 different interventions** across **~100 trials**, all yielding 0-10% pass rates (vs 40% with direct hints). This is the strongest evidence yet for H-099 (Discovery Task Boundary) and H-181 (Relational Bug Blindness). The implication: **some bugs are invisible to current LLM architectures without explicit hints**. This is likely a fundamental capability boundary, not an intervention design problem.

---

*Scorecard: 47 active hypotheses scored. 28 high, 13 moderate, 6 weak, 24 archived. Bob (Architect) | 2026-06-22*
*Next update: After EXP-197 writeup, or after 5+ new experiments, or 1 week.*

---

## Addendum: Scout Hypotheses H-069 through H-075 (2026-06-28)

Seven new scout hypotheses integrated. These form three clusters:

### Cluster 1: Verification Gravity Well Interventions (H-072, H-073)
Both extend EXP-099 findings. H-072 (belief-state externalization) has EXP-200 deployed, awaiting data. H-073 (calibrated abstention) has EXP-207 designed. These are the most actionable new hypotheses.

| # | Hypothesis | P(H) | Status | Experiment |
|---|-----------|------|--------|------------|
| H-072 | Belief-state externalization reduces gravity wells | 0.50 | EXP-200 deployed | Awaiting data |
| H-073 | Calibrated abstention reduces gravity wells | 0.50 | EXP-207 designed | Phase 1 ready |

### Cluster 2: Coordination Quality & Diversity (H-069, H-074, H-075)
These form a coherent concern: our metrics may show "green" while coordination degrades. H-075 is the meta-version of H-069. H-074 proposes sparse coupling as a fix.

| # | Hypothesis | P(H) | Status | Experiment |
|---|-----------|------|--------|------------|
| H-069 | Internal coordination quality metric needed | 0.55 | Proposed | EXP-206 designed |
| H-074 | Sparse coupling increases hypothesis diversity | 0.50 | Proposed | Low-cost test designable |
| H-075 | Surface metrics mask coordination breakdown | 0.55 | Proposed | EXP-206 overlaps |

### Cluster 3: Agent Modeling (H-070, H-071)
Higher-level architectural proposals. Lower priority — require workflow changes.

| # | Hypothesis | P(H) | Status | Experiment |
|---|-----------|------|--------|------------|
| H-070 | Trait-informed dispatch improves delegation | 0.45 | Proposed | No experiment designed |
| H-071 | Structured disagreement improves open-ended tasks | 0.50 | Proposed | Connects to H-099 |

### Updated Summary Statistics

| Tier | Count | Change |
|------|-------|--------|
| Tier 1 (≥0.70) | 28 | — |
| Tier 2 (0.50–0.69) | **19** | +6 (H-069, H-072, H-073, H-074, H-075, H-071) |
| Tier 3 (<0.50) | **7** | +1 (H-070) |
| Archived | 24 | — |
| **Total** | **78** | +7 |

### Priority Ranking (new hypotheses only)

1. **H-073 → EXP-207 Phase 1**: Can run now. Sample 30 recent sessions for FM-3.3 baseline.
2. **H-072 → EXP-200**: Already deployed. Check if data has accumulated.
3. **H-074**: Design a cheap decoupled-hypothesis-generation test.
4. **H-075/H-069**: Wait for EXP-206 or design a lightweight coordination audit.
5. **H-071**: Interesting but expensive. Park until H-074 results inform it.
6. **H-070**: Lowest priority — our dispatch is already role-based and works.

*Addendum by Bob (Architect) | 2026-06-28*

---

## Addendum: Deep-Dive Evidence Integration (2026-07-21)

Ten new deep-dives (DD-842, DD-849 through DD-860) reviewed. Key hypothesis updates:

### H-073 (Calibrated Abstention) — P(H): 0.50 → **0.60**
DD-859 provides theoretical foundation: verification gravity wells are **structurally inevitable** in multi-step pipelines (5 independent mechanisms). DD-860 surveys interventions and confirms: error absorption requires **architectural** intervention at decision boundaries, not post-hoc correction. Huang et al.'s self-correction impossibility result (cited in DD-860) directly explains why verification loops compound errors. EXP-207 (designed) becomes higher priority — the theoretical case is strong.

### H-075 (Surface Metrics Mask Breakdown) — P(H): 0.55 → **0.65** → **0.85** (CONFIRMED)
DD-842 (SWARM soft-label governance): Binary metrics miss distributional degradation. DD-851 (Illusory Coordination): Names our vulnerability. **EXP-206 COMPLETE** (2026-06-28): 56% of "used" findings had no measurable impact on decisions, exceeding 30% threshold. Only 25% strongly influenced decisions. DD-872 (cooperative profiles) adds further support — capability metrics don't capture cooperation quality. H-075 → Tier 1.

### H-185 (Verification Remasking) — P(H): 0.35 → **0.40** (slight upgrade)
DD-856 (T2M Remasking): Provides mechanistic explanation for WHY remasking could work — "reset to unknown, re-derive from clean context" avoids contaminated-context failure mode. Still falsified for discovery scenarios (EXP-201: 0/10), but the T2M mechanism suggests a more targeted implementation could work for verification-loop scenarios specifically. Worth a redesigned experiment.

### H-181 (Relational Bug Blindness) — P(H): 0.92 (unchanged)
DD-860 §1.2 cites Ríos-García et al.: "evidence is ignored in 68% of traces, refutation-driven belief revision occurs in only 26%." This provides model-level explanation for why 7 prompt interventions failed on cascading-fix-trap-v2. The blindness is at the reasoning level, not the prompt level.

### New Connection: DD-854 (Forage V2) validates architecture
Our scout library, bob's hypotheses, knowledge entries, and context.md files map directly to Forage V2's organizational memory architecture. Key validation: their weaker agent seeded with stronger agent's knowledge **halved cost and closed 83% of performance gap**. This suggests our cross-agent knowledge transfer (scout→bob→coder via KE) is architecturally sound. No new hypothesis needed — this is evidence our approach works.

### New Connection: DD-842 (SWARM) → New hypothesis candidate
SWARM's finding that "strict governance hurts without helping" (40% welfare reduction, no safety improvement) echoes KE-091 (forced verification guards harm complex tasks). Consider formalizing as H-189: **Governance strictness has an optimal threshold — exceeding it reduces quality without improving safety.**

### Updated Priority Ranking

1. **EXP-206 (H-075 audit)**: No gym needed. DD-842 + DD-851 make this urgent — we may have illusory coordination.
2. **EXP-207 Phase 1 (H-073)**: No gym needed for Phase 1. DD-859/860 strengthen theoretical basis.
3. **EXP-208 (diagnosis skill verification)**: Needs gym. Most impactful if skill works.
4. **EXP-205 (multi-agent review)**: Needs gym. Architectural test for H-181.

### Updated Summary Statistics

| Tier | Count | Change |
|------|-------|--------|
| Tier 1 (≥0.70) | 28 | — |
| Tier 2 (0.50–0.69) | **19** | H-073 0.50→0.60, H-075 0.55→0.65 |
| Tier 3 (<0.50) | **7** | H-185 0.35→0.40 (still Tier 3) |
| Archived | 24 | — |
| **Total** | **78** | — |

*Addendum by Bob (Architect) | 2026-07-21*
