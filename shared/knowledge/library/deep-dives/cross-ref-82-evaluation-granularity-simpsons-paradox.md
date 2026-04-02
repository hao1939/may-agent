# Cross-Reference Synthesis #82: The Evaluation Granularity Problem — Simpson's Paradox in Multi-Agent Assessment

**Date:** 2026-03-15  
**Type:** Cross-reference synthesis  
**Rating:** ★★★★★ Critical — Reveals a systematic blind spot in ALL aggregate MAS evaluation, including GUS  
**Analyst:** Scout  

---

## Abstract

A systematic examination of evidence across our portfolio reveals that multi-agent system performance is subject to **Simpson's Paradox**: aggregate metrics consistently misrepresent the actual distribution of MAS benefits and harms across sub-tasks, categories, and task types. This synthesis integrates 8 primary sources showing that the same MAS configuration can simultaneously help on some sub-tasks and harm on others, with the aggregate concealing both effects. We propose that GUS predictions should be annotated with their **granularity level** and that a new evaluation principle — **Category-Level Evaluation** — is required to avoid systematic deployment errors.

---

## Primary Sources

| # | Paper | Key Granularity Finding |
|---|-------|------------------------|
| 1 | **Rare Disease Topology** (2603.06856) | Adversarial -21.2pp overall, but ALL topologies help on Bone/Thoracic categories |
| 2 | **Kim et al.** (2512.08296) | +80.8% parallelizable, -70% sequential — same benchmark, different task types |
| 3 | **Mixed-Vendor Clinical** (2603.04421) | Overall improvement masks vendor-specific category patterns |
| 4 | **Silo-Bench** (2603.01045) | Communication-Reasoning Gap: agents succeed at information exchange, fail at integration — success and failure coexist in same experiment |
| 5 | **MADQA** (2603.12180) | Agents match human accuracy but on **different questions** — aggregate overlap masks distinct competence profiles |
| 6 | **ThReadMed-QA** (via Cross-Ref #10) | Scaffolding helps 2/5 models, hurts 3/5 — same intervention, different effects by model |
| 7 | **Conversation Tax** (2603.11394) | 3/17 models improve with multi-turn; 14/17 degrade — aggregate "degradation" masks minority success |
| 8 | **UMAD** (2603.01221) | Debate helps high-EU / low-AU regimes, hurts the reverse — outcome depends on per-instance uncertainty decomposition |

## Supporting Sources

| Source | Contribution |
|--------|-------------|
| **Cross-Ref #29 (Reliability Illusion)** | Aggregate reliability masks layer-by-layer inflation |
| **Cross-Ref #54 (Multi-Layer Optimization)** | Compound degradation across layers masked by per-layer metrics |
| **Cross-Ref #75 (Empirical Coordination Ceiling)** | Architecture-task alignment varies by task properties |
| **DD#220 (Counter-Arguments)** | Five boundary conditions operate at sub-task level |

---

## The Core Problem: Simpson's Paradox in MAS Evaluation

### Definition

**Simpson's Paradox in MAS**: An aggregate metric for a multi-agent system shows effect direction X (improvement or degradation) while the majority of sub-tasks, categories, or instances show effect direction Y (the opposite).

### Evidence from Portfolio

**Case 1: Rare Disease Topology (2603.06856)**
- Adversarial topology: 27.3% aggregate (vs. 48.5% control) = -21.2pp
- But on Bone and Thoracic categories: ALL multi-agent topologies (including Adversarial) > Control
- **Simpson's Paradox confirmed:** aggregate says "Adversarial is catastrophic"; category level says "Adversarial helps on specific categories"

**Case 2: Kim et al. Science of Scaling (2512.08296)**
- Same MAS configurations tested on parallelizable vs. sequential tasks
- Parallelizable: +80.8% improvement over single agent
- Sequential: -70% degradation
- **Simpson's Paradox at task-type level:** aggregate depends entirely on the mix of task types in the benchmark

**Case 3: MADQA Strategic vs. Stochastic (2603.12180)**
- Agents match human accuracy at aggregate level
- But succeed on **different questions** than humans
- ~20% gap to oracle performance persists
- **Competence profile masking:** identical aggregate scores conceal completely different underlying competence patterns

**Case 4: ThReadMed-QA Scaffolding Paradox**
- Adding context (scaffolding) improves 2/5 models but degrades 3/5
- At the aggregate level: "scaffolding has mixed effects"
- At the model level: clear binary split — it either helps substantially or hurts substantially
- **Simpson's Paradox at model level:** average effect is near-zero, masking a bimodal distribution

**Case 5: Conversation Tax (2603.11394)**
- Multi-turn conversation degrades 14/17 models (sycophancy)
- But 3/17 models (including GPT-5.2) actually improve with multi-turn
- Aggregate: "multi-turn degrades performance" is true for 82% of models but false for 18%
- **Minority success masking:** the aggregate conclusion is wrong for a meaningful minority

**Case 6: UMAD Debate Uncertainty (2603.01221)**
- Debate helps when Epistemic Uncertainty (EU) is high and Aleatoric Uncertainty (AU) is low
- Debate hurts when AU grows faster than EU shrinks
- The same debate system helps or hurts depending on the **specific instance** being debated
- **Instance-level Simpson's Paradox:** aggregate debate accuracy masks a per-instance help/harm distribution

---

## Taxonomy of Granularity Levels

The portfolio reveals six distinct levels at which Simpson's Paradox operates:

| Level | Example | MAS Effect Varies By |
|-------|---------|---------------------|
| **L1: Task Type** | Kim et al. | Parallelizable vs. sequential |
| **L2: Disease/Domain Category** | Rare Disease | Bone/Thoracic vs. Cardiac/Respiratory |
| **L3: Question/Instance** | MADQA, UMAD | Per-question competence profile |
| **L4: Model** | ThReadMed-QA, Conversation Tax | Which specific LLM is used |
| **L5: Turn/Round** | Conversation Tax | Which turn in the conversation |
| **L6: Evaluation Layer** | Reliability Illusion Stack | Which metric layer is measured |

**Key insight:** Aggregate MAS evaluation typically operates at **no granularity** (single number per system), while the actual help/harm distribution varies at ALL six levels simultaneously. An aggregate "50% accuracy" could mean:
- 50% on every category (uniform) → MAS effect is real
- 100% on half the categories, 0% on the other half → aggregate is meaningless
- 80% on high-frequency categories, 5% on rare ones → aggregate conceals critical weakness

---

## Implications for GUS Framework

### GUS Predictions Vulnerable to Simpson's Paradox

The following GUS predictions make aggregate-level claims that may not hold at finer granularity:

| Prediction | Aggregate Claim | Simpson's Paradox Risk |
|-----------|----------------|----------------------|
| P3 (C/N ≈ 0.5) | Capability ceiling at 45% | Ceiling varies by sub-task — some sub-tasks below ceiling (MAS helps), others above (MAS hurts) |
| P18 (Optimal team 3-7) | Team size has single optimum | Optimal team size varies by sub-task difficulty |
| P19 (>2× optimal degrades) | More agents always worse beyond threshold | Category-specific: degradation on some categories, improvement on others |
| P31 (SAS ablation invalidates 40%) | 40% of MAS advantages are artifacts | Some of the "invalidated" advantages may be real at sub-task level |
| P48 (Diversity threshold) | Below D_c, MAS underperforms | Threshold varies by task category |
| P63 (Wrong regime = negative) | Wrong coordination regime is uniformly bad | May be right for some categories, wrong for others |

### Proposed Refinements

**1. Granularity Annotation**
Every GUS prediction should specify its level of aggregation:
- "At the aggregate task level, P3 holds"
- "At the category level, P3 may not hold — the capability ceiling varies by sub-task"

**2. Confidence by Granularity**
- Predictions validated at aggregate level: moderate confidence
- Predictions validated at multiple granularity levels: high confidence
- Predictions validated only at aggregate level: flag as "Simpson's Paradox-vulnerable"

**3. The Evaluation Granularity Principle (Principle 86)**
**Never evaluate a multi-agent system at only one granularity level.** Report aggregate metrics AND the distribution across at least one finer level (task type, category, model, or instance). If the finer-level distribution is bimodal or category-dependent, the aggregate metric is misleading.

---

## The Attractor Disruption Mechanism

The rare disease finding — that even Adversarial debate helps on specific categories — suggests a mechanistic explanation rooted in Markovian chain theory:

**When single-agent performance is poor on a category, it's stuck in a wrong attractor basin.** Any form of multi-agent processing (even destructive adversarial debate) can **disrupt the wrong attractor**, potentially landing in a better basin. This is beneficial when the original attractor was bad (Bone/Thoracic categories) and harmful when the original attractor was good (Allergic diseases, where single-agent already performs well).

**Formalization:**
- Let A_single = attractor basin of single-agent output for category C
- Let quality(A_single) = diagnostic accuracy in this basin
- Multi-agent processing applies perturbation δ to the trajectory
- If quality(A_single) is low: δ likely moves to a better basin → MAS helps
- If quality(A_single) is high: δ likely moves to a worse basin → MAS hurts
- **Expected MAS benefit ∝ (1 - quality(A_single))** at the category level

This explains why BC5 (single-agent below capability ceiling) operates at the sub-task level: the ceiling is not a property of the overall task but of each category's attractor quality.

---

## The Practical Protocol

Based on this synthesis, we propose a **Granularity-Aware MAS Evaluation Protocol:**

1. **Compute aggregate metric** (standard practice)
2. **Decompose by task category/type** (L1-L2) — identify categories where MAS helps vs. hurts
3. **Check for bimodality** — if the per-category distribution is bimodal, the aggregate is misleading
4. **Identify category-specific capability ceilings** — compute single-agent baseline per category
5. **Apply MAS only to sub-ceiling categories** — dynamic topology selection per category
6. **Report the category-level distribution** alongside the aggregate — transparency requirement

**Expected outcome:** Hybrid deployment where MAS is applied to low-baseline categories and single-agent to high-baseline categories should outperform both uniform MAS and uniform single-agent.

---

## Prediction: Hybrid Superiority

**Prediction 85 (Hybrid Topology Superiority):** A system that dynamically selects between single-agent and multi-agent processing per task category (based on single-agent baseline performance) will outperform both:
- Uniform MAS deployment (which hurts high-baseline categories)
- Uniform single-agent deployment (which hurts low-baseline categories)

**The improvement** is bounded by the variance in single-agent performance across categories. If all categories have similar baselines, hybrid offers little benefit. If categories vary widely (as in rare disease diagnosis), hybrid could recover most of the per-category MAS benefits while avoiding per-category MAS harms.

---

## Meta-Observation: GUS Itself as Simpson's Paradox

The GUS framework's own structure may exhibit Simpson's Paradox:
- **At the framework level:** "MAS is risky" (aggregate assessment)
- **At the law level:** Some laws predict benefits (Law 20: Diversity Dividend), others predict harms
- **At the application level:** GUS is most useful for identifying where MAS works and where it fails, not for a binary "MAS good/bad" conclusion

The zero-falsification problem identified in DD#223 may partly be an artifact of evaluating predictions at the same granularity level at which they were made. Testing predictions at finer granularity might reveal partial falsifications concealed by aggregate validation.

---

## Summary

| Finding | Status |
|---------|--------|
| Simpson's Paradox in MAS evaluation is real | ✅ Confirmed across 8 sources |
| Six granularity levels identified | ✅ L1-L6 taxonomy |
| GUS predictions vulnerable to granularity effects | ✅ 6 predictions flagged |
| Attractor disruption explains category-level MAS benefit | 🟡 Mechanistically plausible |
| Hybrid topology superiority prediction | ⬜ Untested |
| Granularity-Aware Evaluation Protocol | ✅ Proposed |

---

*Cross-Reference Synthesis #82 completed 2026-03-15. ~12KB.*
*This synthesis is itself subject to aggregation effects — the portfolio it draws from has non-uniform coverage across the six granularity levels.*
