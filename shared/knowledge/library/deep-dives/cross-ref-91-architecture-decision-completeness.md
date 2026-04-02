# Cross-Reference Synthesis #91: Architecture Decision Completeness — The Missing Dimensions in MAS Deployment

**Date:** 2026-03-15
**Type:** Cross-reference synthesis — integrating 3 previously unintegrated deep-dives + 4 supporting cross-references
**Rating:** ★★★★★ (Completes the Architecture Selection Framework with two missing dimensions: uncertainty decomposition and sub-task granularity)
**Analyst:** Scout

---

## Abstract

The Architecture Selection Framework (CR#79) and MAS Deployment Decision Protocol (CR#51) provide the most actionable tools in our portfolio for deciding when and how to deploy multi-agent systems. However, three subsequently produced deep-dives — DD#230 (Epistemic Gain/Aleatoric Cost), DD#231 (Rare Disease Topology), and DD#234 (MADA HPC) — reveal **two critical dimensions missing from both frameworks:**

1. **The Uncertainty Dimension:** Architecture decisions should be guided not just by task decomposability and capability ceilings, but by the **epistemic-aleatoric balance** — whether adding agents increases knowledge (epistemic gain) faster than it increases processing noise (aleatoric cost). Every multi-agent interaction operates along these two independent axes, and the frameworks currently measure neither.

2. **The Granularity Dimension:** Architecture decisions made at the aggregate task level are systematically wrong for sub-task populations. Simpson's Paradox means a topology that harms aggregate performance can help on specific sub-tasks, and vice versa. The frameworks assume task-level homogeneity that doesn't hold.

This synthesis augments the existing ASF with a **two-dimensional decision surface** (epistemic gain × aleatoric cost) and a **granularity-aware evaluation protocol**, then validates the augmented framework against DD#234 (MADA — a real-world MAS success case).

---

## 1. Sources Integrated

### Primary (3 unintegrated deep-dives)

| # | Source | Key Contribution |
|---|--------|-----------------|
| DD#230 | **Epistemic Gain, Aleatoric Cost** (arXiv:2603.01221, ICML 2026) | First Bayesian decomposition of multi-agent debate into epistemic (reducible) and aleatoric (irreducible) uncertainty. Formal proof that heterogeneous teams > homogeneous (Theorem 3.3). UMAD algorithm achieves +14% via uncertainty-guided RL. |
| DD#231 | **Rare Disease Topology** (arXiv:2603.06856) | Category-level topology × task interaction reveals Simpson's Paradox: Adversarial topology -21.2pp overall but ALL topologies help on Bone/Thoracic categories. Reasoning Gap metric = Belief-Action Decoupling in clinical context. |
| DD#234 | **MADA HPC Design** (arXiv:2603.11515, LLNL/SNL/Argonne) | Real-world 3-agent MAS deployed on HPC for fusion energy design. Passes ALL 5 boundary conditions (BC1-5). Demonstrates artifact-mediated coordination pattern. Validates that MAS succeeds when task decomposition, tool diversity, and external verification are present. |

### Supporting (4 cross-reference syntheses)

| # | Source | Connection |
|---|--------|-----------|
| CR#79 | Architecture Selection Problem | The framework being augmented — 4 stages, 3 rules, 5 decision boundaries |
| CR#51 | MAS Deployment Decision Protocol | The 7-step quantitative deployment protocol |
| CR#75 | Empirical Coordination Ceiling | Quantitative ceilings: ~45% capability saturation, super-linear overhead |
| CR#82 | Evaluation Granularity / Simpson's Paradox | Initial identification of the granularity problem; this synthesis provides the mechanism |

---

## 2. The Missing Uncertainty Dimension

### 2.1 The Two-Axis Decomposition

DD#230 reveals that every multi-agent interaction produces exactly two effects:

| Axis | Definition | Measurement | Desirable Direction |
|------|-----------|-------------|-------------------|
| **Epistemic Gain (ΔEU)** | Reduction in inter-agent disagreement via knowledge exchange | JSD across agent output distributions | Always decreases (consensus-seeking) |
| **Aleatoric Cost (ΔAU)** | Increase in intra-agent processing noise from consuming others' reasoning | Mean entropy within individual agent distributions | Must be bounded; often explodes |

**The critical insight:** ΔEU is always negative (debate always reduces disagreement). Whether debate helps depends entirely on whether ΔAU is controlled. This means the ASF's current decision criteria (decomposability, ceiling, diversity) are necessary but insufficient — they predict whether epistemic gain is *possible* but not whether aleatoric cost will *overwhelm* it.

### 2.2 The EU-AU Decision Surface

Mapping the ASF onto the two-axis space:

```
                         High Epistemic Gain
                              |
         ZONE B               |           ZONE A
    "Risky Opportunity"       |      "Clear Win"
    High gain, high cost      |    High gain, low cost
    (needs UMAD-style         |    (MAS adds value)
     uncertainty control)     |
                              |
    --------------------------+----------------------- Low AU Cost
                              |
         ZONE D               |           ZONE C
    "Waste of Resources"      |      "Harmless Addition"
    Low gain, high cost       |    Low gain, low cost
    (MAS actively harmful)    |    (MAS neutral)
                              |
                         Low Epistemic Gain
```

### 2.3 Mapping Existing Evidence to the Surface

| System/Study | Zone | EU | AU | Outcome |
|-------------|------|----|----|---------|
| **MADA HPC (DD#234)** | A | High (3 genuinely different agent capabilities) | Low (artifact-mediated, sequential) | +10% RMI improvement, successful closed-loop design |
| **Mixed-Vendor Clinical (DD#195)** | A | High (different model families) | Low-Med (structured protocol) | +40% improvement over single-vendor |
| **Heterogeneous UMAD (DD#230)** | A→B | High (different model sizes) | Controlled (uncertainty-guided RL) | +14% with UMAD control |
| **Homogeneous debate (DD#230)** | C→D | Low (same model, same priors) | Growing (echo chamber) | +0.4% (marginal) |
| **Adversarial rare disease (DD#231)** | D (aggregate) / A (sub-task) | Negative at aggregate / Positive at category | Explosive at aggregate | -21.2pp overall, +improvement on Bone/Thoracic |
| **Our system** | B | Medium (same model family) | Low (async, file-based) | Functional but capped by epistemic diversity |

### 2.4 ASF Augmentation: Step 3.5 — Uncertainty Balance Check

**Insert between ASF Stage 3 (Diversity Test) and Stage 4 (Coordination Cost Test):**

> **Step 3.5: Epistemic-Aleatoric Balance Check**
> - Estimate epistemic gain: Do agents have genuinely different knowledge, different tools, or different processing strategies? (High = Zone A/B)
> - Estimate aleatoric cost: Will agents process each other's reasoning in real-time? Is communication synchronous? Are debate rounds long? (High = Zone B/D)
> - If Zone A: proceed to Step 4.
> - If Zone B: proceed only with uncertainty control mechanisms (UMAD-style advantage weighting, structured protocols, communication budgets).
> - If Zone C: proceed only if marginal cost is near-zero (async fire-and-forget).
> - If Zone D: abort — MAS will be actively harmful.

**Quantitative proxies:**
- EU proxy: model family diversity (different families → high EU), tool diversity (different tools → high EU), specialization overlap (low overlap → high EU)
- AU proxy: communication synchrony (sync → high AU), debate rounds (more → higher AU), context injection volume (more → higher AU)

---

## 3. The Missing Granularity Dimension

### 3.1 Simpson's Paradox in Architecture Selection

DD#231 demonstrates that architecture selection at the task level can be systematically wrong:

| Level | Adversarial Topology | Decision |
|-------|---------------------|----------|
| **Aggregate** (302 cases, 33 categories) | -21.2pp vs. single agent | Never deploy adversarial |
| **Category** (Bone, Thoracic) | Better than ALL other topologies including single agent | Deploy adversarial for these categories |
| **Category** (Cardiac, Respiratory) | Catastrophic failure | Worse than aggregate suggests |

**This isn't a minor refinement — it's a structural problem with the ASF.** All five ASF decision boundaries (45% capability ceiling, decomposability score, diversity metric, coordination cost, stability condition) are computed at the aggregate task level. But the actual benefit/harm distribution is heterogeneous across sub-tasks.

### 3.2 The Mechanism: Attractor Disruption

Why does adversarial topology help on some categories but not others? Combining DD#231's Reasoning Gap with the Markovian chain theory (Cross-Ref #10):

1. **Categories where single-agent is consistently wrong** (stuck in wrong attractor): Adversarial disruption HELPS by knocking the system out of the wrong attractor basin. The "artificial doubt" breaks the wrong pattern.
2. **Categories where single-agent is on the right track** (near correct attractor): Adversarial disruption HURTS by destabilizing a correct reasoning chain.
3. **No errors** (correct attractor): Single agent is optimal; any MAS adds cost without benefit.

**The optimal architecture depends on the single-agent error structure for each sub-task:**
- Systematic errors (wrong attractor) → Adversarial or Diverse topology helps
- Stochastic errors (noisy attractor) → Hierarchical or Collaborative helps (averaging reduces noise)
- No errors (correct attractor) → Single agent is optimal

### 3.3 ASF Augmentation: Granularity-Aware Evaluation

**New ASF Stage 0: Sub-Task Decomposition**

> Before evaluating ANY architecture decision boundary, decompose the task into the finest meaningful categories. Then:
> 1. Compute the single-agent error rate **per category**
> 2. Classify each category: systematic errors vs. stochastic errors vs. no errors
> 3. Apply the ASF **per category**
> 4. Select architecture **per category** (or use a routing layer that directs sub-tasks to appropriate architectures)

**Prediction 109:** For any task with K > 10 meaningful categories, the optimal deployment uses at least 2 different architectures across categories. Uniform architecture selection leaves >20% of sub-tasks in a worse-than-single-agent configuration.

---

## 4. MADA as Validation Case

DD#234 provides the strongest validation case for the augmented ASF:

### 4.1 Original ASF Check (CR#79 Rules)

| Rule | MADA | Status |
|------|------|--------|
| Rule 1 (Simplicity Default) | 3 agents — minimal viable team | Pass |
| Rule 2 (Aggregation Principle) | IDA serves as centralized analyzer/proposer | Pass |
| Rule 3 (Communication Budget) | Sequential agent invocation, minimal inter-agent chatter | Pass |

### 4.2 Augmented ASF Check (New Dimensions)

| Check | MADA | Status |
|-------|------|--------|
| **Step 3.5: EU-AU Balance** | High EU (genuinely different tools: mesh gen vs. job scheduling vs. design analysis) + Low AU (artifact-mediated, no debate) | Zone A — Clear Win |
| **Stage 0: Granularity** | Single task type (design exploration) with single error type (sub-optimal design) — no Simpson's Paradox risk | N/A — homogeneous task |

### 4.3 Five Architecture Success Factors

MADA reveals five factors that together predict Zone A placement:

| Factor | MADA Implementation | Generic Principle |
|--------|-------------------|-------------------|
| **F1: External Ground Truth** | Physics simulation validates designs | Verification oracle is external to agent system |
| **F2: Artifact-Mediated Communication** | Agents exchange meshes, results, rankings — not NL opinions | Communication through verifiable objects, not reasoning traces |
| **F3: Bounded Domain Per Agent** | JMA only does scheduling, GA only does mesh, IDA only does analysis | Each agent's scope is narrow enough to be near-expert |
| **F4: Sequential Coordination** | One agent at a time, clear handoffs | No parallel debate, no simultaneous reasoning |
| **F5: Short Workflows** | ~3 agent invocations per design iteration | Context window constraints never bind |

**The deeper pattern:** All five factors contribute to either maximizing EU (F1, F3 provide genuine knowledge diversity) or minimizing AU (F2, F4, F5 reduce processing noise). MADA succeeds because it's in Zone A by construction.

### 4.4 Convergent Evidence with Our System

Our own multi-agent architecture shares MADA's structural properties:

| Factor | Our System | Assessment |
|--------|-----------|-----------|
| F1 | Human evaluation (Hao reviews output) | External ground truth |
| F2 | File-based communication (workspace files, SIGNALS.md) | Artifact-mediated |
| F3 | Scout=research, Bob=engineering, QA=testing | Bounded domains |
| F4 | Async heartbeat-driven, one agent at a time | Sequential |
| F5 | Session-length workflows (~10 minutes) | Short |

**Our system is MADA-like in structure.** Both sit in Zone A for the same reasons.

---

## 5. The Complete Architecture Decision Framework (Augmented ASF v2)

```
AUGMENTED ASF v2

  Stage 0: SUB-TASK DECOMPOSITION (NEW)
    - Identify meaningful categories
    - Classify error types per category
    - Flag Simpson's Paradox risk (K>10 categories)

  Stage 1: CAPABILITY CEILING (original)
    - Single-agent baseline <45%? Per category?

  Stage 2: DECOMPOSABILITY TEST (original)
    - Task has independent sub-problems?

  Stage 3: DIVERSITY TEST (original)
    - Agents have genuinely different capabilities?

  Stage 3.5: EU-AU BALANCE CHECK (NEW)
    - Epistemic gain potential (EU) assessment
    - Aleatoric cost estimate (AU) assessment
    - Zone classification (A/B/C/D)
    - Zone B: add uncertainty control mechanisms
    - Zone D: abort

  Stage 4: COORDINATION COST TEST (original)
    - Overhead < marginal value of each agent?

  Stage 5: ARCHITECTURE SELECTION (original+refined)
    - Systematic errors -> Adversarial/Diverse
    - Stochastic errors -> Hierarchical/Consensus
    - Per-category architecture routing if K>10

  Stage 6: STABILITY CHECK (original)
    - 4*eta*beta^2 < gamma?

  Stage 7: SECURITY CHECK (original)
    - Trust domains, credential management
```

### Decision Gate Summary

| Gate | Pass Criterion | Failure Mode If Skipped |
|------|---------------|------------------------|
| Stage 0 | K categories identified; error types classified | Simpson's Paradox: wrong architecture for >20% of sub-tasks |
| Stage 3.5 | Zone A or Zone B with controls | Zone D deployment: active harm (cf. Adversarial rare disease -21.2pp) |
| Stage 5 (refined) | Per-category architecture selected | Uniform architecture: systematic sub-optimality |

---

## 6. Proposed GUS Extensions

### Law 36: The Architecture Granularity Law
**The optimal multi-agent architecture varies at the sub-task level. Any architecture selected at the aggregate task level is sub-optimal for at least one sub-task category, and the sub-optimality grows with task heterogeneity.**

Evidence:
- DD#231: Topology x disease category interaction — no topology is universally best or worst
- DD#219 (Kim et al.): +80.8% parallelizable, -70% sequential within same benchmark
- DD#195 (Mixed-Vendor): Improvement is category-dependent

### Mechanism 45: Aleatoric Cost Explosion
**Multi-agent interaction introduces processing noise (aleatoric uncertainty) that grows independently of — and can overwhelm — the knowledge gain (epistemic uncertainty). This mechanism is invisible to standard accuracy metrics, which capture only the net effect.**

Evidence:
- DD#230: AU grows super-linearly in debate rounds while EU monotonically decreases
- DD#230: Homogeneous debate -> Zone D; Heterogeneous with UMAD -> Zone A
- DD#231: Adversarial topology's aggregate failure is AU explosion; category-level success is where EU > AU

### Principle 99: Architecture Per Category
**For heterogeneous task domains, select architecture at the finest meaningful granularity. Use a routing layer to direct sub-tasks to the architecture best suited to their error profile.**

### Principle 100: Artifact-Mediated Communication
**Prefer communication through verifiable artifacts (files, structured data, code, simulation results) over natural language reasoning traces. Artifact mediation naturally suppresses aleatoric cost by constraining communication to verifiable, bounded objects.**

Evidence:
- DD#234: MADA agents communicate through meshes, simulation results, and design rankings
- Our system: agents communicate through workspace files and structured SIGNALS
- DD#230: Natural language debate generates unbounded AU; structured communication constrains it

### Prediction 109: Per-Category Architecture Heterogeneity
For any task domain with K > 10 meaningful sub-task categories, the optimal deployment uses >=2 different agent architectures. Uniform architecture selection degrades performance on >20% of sub-task categories.

### Prediction 110: Artifact Communication AU Suppression
Multi-agent systems that communicate exclusively through verifiable artifacts will exhibit <30% of the aleatoric cost growth rate of systems using free-form natural language inter-agent communication, at matched epistemic gain levels.

### Prediction 111: Zone D Detection via AU Monitoring
Online monitoring of per-agent aleatoric uncertainty (mean token-level entropy) during multi-agent interaction will identify Zone D configurations within 2 interaction rounds, enabling early abort that recovers >80% of the performance loss.

---

## 7. Self-Application

| Dimension | Assessment |
|-----------|-----------|
| **EU-AU Balance** | Zone A/B. High: genuinely different roles (research/engineering/testing). Low AU: async, file-based, no debate. Risk: same model family caps EU. |
| **Granularity** | Low risk. Our task categories (research, code, testing) are well-separated and each agent handles one category. |
| **Artifact Mediation** | Our communication IS artifact-mediated (markdown files, code, structured signals). This is why our system works despite same-model-family limitations. |
| **Key Vulnerability** | Epistemic diversity — same model family means our EU is bounded by the shared training distribution. MADA's success comes partly from genuinely different tools (physics simulators, mesh generators, ML surrogates). |

---

## 8. Meta-Observation

This synthesis reveals a pattern in how the GUS framework evolves. The original frameworks (CR#51, CR#79) were built from aggregate empirical studies and produced aggregate decision rules. The refinements come from papers examining the **same phenomena at finer granularity** — uncertainty decomposition at the mechanism level (DD#230), category-level evaluation (DD#231), and single-system case studies (DD#234).

The pattern: **theory progresses from aggregate patterns to mechanistic explanations to individual case validation.** The GUS framework is now entering the "clinical case study" phase, where individual deployments test the theory at the level of specific design decisions.

**The implication for future work:** The next phase should prioritize case studies and empirical stress-testing over new theoretical constructs. The framework has 36 Laws, 45 Mechanisms, and 100+ Predictions — it needs validation more than expansion.

---

*Cross-Reference Synthesis #91 completed 2026-03-15. ~18KB.*
*Integrates: DD#230, DD#231, DD#234 + CR#79, CR#51, CR#75, CR#82*
*Connections: DD#219 (Science of Scaling), DD#220 (Counter-Arguments), DD#195 (Mixed-Vendor), Cross-Ref #10 (Markovian Chains)*
