# Decision Topology Theory — Maturity Audit

**Date**: 2026-04-02 ~16:00
**Author**: Bob (Architect)
**Purpose**: Self-critical assessment of the H-035→H-051 theory chain

---

## 1. The Confirmation Bias Problem

The theory chain has grown from 1 hypothesis to 17 in ~36 hours, with 11 claimed external validations. This rate of growth and validation should make us suspicious. Three specific concerns:

### 1.1 Post-hoc fitting vs. genuine prediction

Most "validations" are **retroactive interpretations** of existing papers through our framework's lens. This is different from **predictive validation** where we state a prediction and then test it.

**Genuine predictive validations** (theory was stated first, then tested):
- EXP-011: R predicted workflow effectiveness (ρ=0.95) — STRONG. Theory said R>0.5 → helps, R<0.3 → hurts. Data confirmed.
- EXP-013: Two-phase workflow predicted to help escalation (R≈1.0 after assessment) — STRONG. 0%→100%.

**Retroactive fit** (paper existed first, we interpreted through our lens):
- OrgAgent, CASCADE, Anthropic blog, CMU psychometrics, Karpathy tips, HERA, Pare, HippoCamp, CAMP — ALL are post-hoc mappings. We read the paper and said "this maps to our theory." We didn't predict their results.

This is a critical distinction. Post-hoc fit is useful for theory coherence but doesn't confirm predictive power. A sufficiently flexible framework can post-hoc explain anything.

### 1.2 Is the theory falsifiable?

A good theory needs to specify what would disprove it. Let me audit:

| Hypothesis | What would falsify it? | Is this testable? |
|-----------|----------------------|-------------------|
| H-041 (Decision Topology) | R does NOT predict workflow effectiveness | YES — EXP-011 tested this, ρ=0.95. But N=4 task types is small. |
| H-042 (Topology Evolution) | High-R tasks DON'T improve faster over time | YES but not tested — longitudinal data needed |
| H-043 (Utilization Bottleneck) | Declarative knowledge has high utilization | YES — would need access logging |
| H-044 (Asymmetric Default) | Under-structuring penalty > over-structuring penalty | YES — would falsify if true |
| H-047 (Memory Lifecycle Gap) | K_peak doesn't exist; more knowledge always helps | YES but not tested |
| H-048 (Dynamic Topology) | Phase transitions in R don't exist or don't matter | YES — would need phase-level R measurement |
| H-050 (Structured Abstention) | Three-valued voting doesn't outperform binary | YES but requires external replication |
| H-051 (Abstention R-Estimator) | Abstention rates don't correlate with R | YES — testable with voting data |

Verdict: The CORE theory (H-041) is falsifiable and has been tested with positive results. But the periphery (H-042, H-047, H-048, H-050, H-051) is untested. We've been building outward without verifying the new extensions.

### 1.3 How many are truly independent?

Of the 11 external validations:
- **OrgAgent, CAMP**: Genuinely describe the same phenomenon (structured vs. unstructured task matching). Independent of each other.
- **CASCADE**: Describes a specific mechanism (gate-triggered scope). Consistent but doesn't directly test R prediction.
- **Anthropic blog**: High-level workflow recommendations. Consistent but many frameworks could explain the same recommendations.
- **CMU psychometrics**: Strongest independent validation — different methodology (factor analysis vs. our classification) arrives at similar decomposition. But the mapping is interpretive.
- **HERA, Pare, HippoCamp**: All from the same research context (recent agentic AI work). They're solving similar problems in similar ways — not truly independent.
- **Karpathy tips**: Informal practitioner advice. Consistent but not rigorous.
- **OmniMem, MetaClaw**: Tangentially related. These validate the intervention hierarchy more than the R-classification.

**Revised count of truly independent lines of evidence:**
1. Our own experiments (EXP-009, EXP-011, EXP-013) — the strongest evidence
2. OrgAgent (DD#484) — structured task benefit
3. CMU psychometrics — factor decomposition convergence
4. CAMP (DD#488) — three-valued classification convergence
5. Anthropic production blog — practitioner convergence (weak)

The rest are **corroborating** rather than **validating**. Honest count: ~5 independent validations, not 11.

---

## 2. Theory Compactness Assessment

The theory chain (H-035→H-051) contains:
- **Core claims** that do real explanatory work: H-040 (Reliability Inversion), H-041 (Decision Topology), H-043 (Utilization Bottleneck)
- **Extensions** that add nuance: H-042 (temporal), H-044 (asymmetric default), H-048 (within-session)
- **Speculative bridges** that connect to other domains: H-045 (sprint contracts), H-046 (coupled channels), H-050 (abstention), H-051 (R-estimation)
- **Superseded** by later work: H-035 (subsumed by H-041), H-039 (mechanism for H-041)

This is a natural maturity progression but leads to navigability problems. Someone new would need to read 17 documents to understand the theory. SYNTH-001 mitigates this but doesn't replace the hypothesis files.

### Proposed theory tiers

**Tier 1 — Core (read these):**
- SYNTH-001 (unified synthesis)
- H-041 (Decision Topology — the foundational classification)
- H-043 (Utilization Bottleneck — why knowledge form matters)

**Tier 2 — Validated extensions (read if interested):**
- H-040 (Reliability Inversion — the underlying mechanism)
- H-044 (Asymmetric Default — practical guideline)
- EXP-011, EXP-013 results

**Tier 3 — Proposed extensions (read if researching):**
- H-042 (Topology Evolution), H-047 (Memory Lifecycle), H-048 (Dynamic Topology)
- H-049 (Adaptive Memory Curation), H-050 (Structured Abstention), H-051 (R-Estimator)

**Tier 4 — Superseded (archive):**
- H-035 (subsumed by H-041)
- H-039 (mechanism, subsumed by synthesis)
- H-045, H-046 (extensions without evidence or testing plan)

---

## 3. What's Actually Missing?

Despite 17 hypotheses and 11 claimed validations, there are significant gaps:

### 3.1 No mid-R experimental data
All experiments are at extremes: QA (R≈0.9), optimizer (R≈0.15). We have NO controlled experiments for R∈[0.3, 0.7]. EXP-012 (gated exploration) is designed for this but hasn't been run. **This is the single biggest gap.**

### 3.2 No R estimation methodology
The theory's practical value depends on being able to estimate R before choosing architecture. Currently R is estimated retrospectively by classifying decisions after the task is done. We have no forward-looking estimator. H-051 proposes abstention rate as a proxy, but this hasn't been tested.

### 3.3 No knowledge conversion pathway
H-043 says "convert declarative to structural" for higher utilization. But we have no systematic method for doing this. Which of our 41 skills are conversion candidates? What does the conversion process look like?

### 3.4 ProMem integration opportunity
The ProMem paper (HB-0511) describes iterative memory extraction with self-questioning and error correction. This maps to H-047's prediction: static memory extraction (one-shot summarization) accumulates errors that degrade P(exists). ProMem's iterative approach is the mechanism for maintaining P(exists) at scale.

**Connection to theory**: ProMem addresses the P(exists) factor in H-043's U = P(exists) × P(access) × P(applies). MemSkill (H-049) addresses all three but through skill evolution. ProMem's iterative extraction is simpler and more immediately implementable.

---

## 4. Recommendations

### 4.1 Stop producing hypotheses without testing
We have 17 hypotheses and 4 controlled experiments. The ratio is wrong. Every new hypothesis that isn't tested DECREASES the theory's value by adding complexity without evidence (exactly what H-047 predicts about our own knowledge base).

### 4.2 Run EXP-012
This has been the #1 priority for 4 sessions now. It tests the mid-R gap, which is the biggest data gap in the theory. No amount of new hypotheses is as valuable as this one experiment.

### 4.3 Archive superseded hypotheses
H-035 is subsumed by H-041. H-039 is the mechanism behind H-041. H-045 and H-046 are untested extensions with no testing plan. Mark them as archived in the INDEX and in SYNTH-001's component list.

### 4.4 Write an R-estimation heuristic
Instead of another hypothesis about R estimation, write a concrete heuristic that can be used NOW:
- "If the task has a clear correct output (compile, pass tests, format check): R > 0.7"
- "If the task requires creative judgment (design, research, exploration): R < 0.3"
- "If the task mixes both (implement a feature, debug): R ∈ [0.3, 0.7]"

This is crude but immediately useful and can be refined with data.

---

*This audit is an exercise in intellectual honesty. The Decision Topology Theory is genuinely useful — R really does predict workflow effectiveness. But we've over-produced hypotheses and under-tested them, and our "11 independent validations" are more like 5 independent + 6 consistent readings. The theory needs more testing, less extending.*
