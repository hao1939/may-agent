# CR#195: The Universal Non-Monotonicity Principle — Seven Dimensions of "Enough" in Multi-Agent LLM Systems

**Cross-Reference Synthesis #195**  
**Rating:** ★★★★★ CRITICAL — CAPSTONE META-SYNTHESIS  
**Date:** 2026-03-16  
**Type:** Grand unification of portfolio's most repeated structural pattern

**Primary Cross-References (7 independent convergence points):**
- CR#181 (Coordination Tax) — coordination dimension
- CR#191 (Compression-Truth Gap) — information fidelity dimension
- CR#193 (Parsimony Paradox) — information quantity dimension
- CR#194 (Governance Dosage) — governance intensity dimension
- CR#192 (Iatrogenesis Proof) — alignment dimension
- CR#182 (Compute Budget Problem) — reasoning compute dimension
- CR#62 (Reasoning Compute Allocation) — step-level compute dimension

**Supporting Deep-Dives (12):**
- DD#268 (LLM Teams as Distributed Systems), DD#349 (Less is More), DD#347 (Compression-Truth Gap), DD#348 (Alignment Backfire), DD#345 (HAIG Governance), DD#265 (DCI Deliberation), DD#208 (Information Self-Locking), DD#291 (ReBalance), DD#304 (CRYSTAL), DD#335 (EduClaw Scaling), DD#280 (Semantic Invariance), DD#296 (LMEB)

**Supporting Cross-References (8):**
- CR#53 (Knowledge Retrieval Paradox), CR#29 (Reliability Illusion), CR#65 (Safety Iatrogenesis), CR#41 (RL Training Traps), CR#100 (What GUS Gets Wrong), CR#188 (Coordination Spectrum), CR#179 (Signal Extraction Problem), CR#170 (Compute Allocation Stack)

---

## Executive Summary

Across 194 cross-reference syntheses and 349 deep-dives, the single most-repeated structural finding in this portfolio is: **adding more of a beneficial input eventually makes the system worse.** This manifests independently across at least seven distinct dimensions — coordination, information quantity, information fidelity, governance, alignment, reasoning compute, and evaluation intensity. We formalize this as the **Universal Non-Monotonicity Principle (UNMP)** and show it emerges from a single mechanism: **correlated error amplification under bounded channel capacity.**

The practical implication is that every design decision in a multi-agent LLM system has an *optimal dosage*, and exceeding it doesn't merely waste resources — it actively degrades performance. The portfolio provides quantitative evidence for threshold values in 5 of 7 dimensions and formal mechanisms explaining the transition from beneficial to harmful in all 7.

---

## 1. The Seven Dimensions of Non-Monotonicity

### 1.1 Dimension 1: Coordination (CR#181)

**Empirical finding:** Adding agents to multi-agent systems produces net-negative returns in 4 of 6 empirically tested configurations.

| Configuration | Tokens | Speedup | Net |
|---|---|---|---|
| Centralized 5-agent parallel | 1.33× | 3.35× | ✅ +2.5× |
| ACO pheromone routing | Low | 4.7× | ✅ +4.5× |
| Decentralized 5-agent | 4.65× | 0.88× | ❌ -5.3× |
| Centralized 5-agent serial | 5.76× | 0.79× | ❌ -7.3× |
| DCI 5-phase deliberation | 62× tokens | +0.95 quality | ❌ -65× per point |
| Tool enrichment | Marginal | Saturates at 7-8 | ❌ Past saturation |

**Threshold:** Coordination pays off only when the *parallel independence ratio* exceeds ~0.6 (i.e., >60% of subtasks can execute independently). Below this, coordination overhead exceeds the benefit of parallelism.

**Mechanism:** Communication costs grow O(n²) with agents while decomposable benefit grows at most O(n). Past the crossover point, every added agent reduces per-agent efficiency more than it adds capacity.

### 1.2 Dimension 2: Information Quantity (CR#193)

**Empirical finding:** Removing 33 of 83 observation dimensions (40% of information) *improves* coordination success by 4.4% and reduces collisions by 11.9% in multi-agent pursuit tasks (DD#349).

**The phase transition:** Below a quality threshold q*, zero communication strictly dominates degraded communication. The threshold depends on *error correlation* ρ between agents:

```
q_threshold = 0 when ρ > √(α/β)
```

where α = benefit coefficient, β = error amplification coefficient.

**Mechanism:** Shared environmental priors (stable, uncorrelated) outperform shared execution states (volatile, correlated). When shared information carries correlated errors, these compound quadratically: E_compound ~ N × ρ × ε² rather than the N × ε² of independent errors.

### 1.3 Dimension 3: Information Fidelity (CR#191)

**Empirical finding:** LLMs prefer compressible (coherent) information over true information. In multi-agent pipelines, each handoff acts as a compression filter, systematically preserving coherent falsehoods while discarding fragmentary truths (DD#347).

**Threshold:** Inter-agent consistency checks provide positive value only when they create *asymmetric* compression pressure — forcing information to be not just coherent but causally/externally grounded. Without this asymmetry, more verification stages produce *more confident* wrong answers.

**Mechanism:** Compression-Consistency Selection. Each inter-agent handoff selects for compressibility. Since coherent falsehoods compress better than messy truths (by definition — reality has noise), multi-agent pipelines amplify falsehood monotonically with depth.

### 1.4 Dimension 4: Governance Intensity (CR#194)

**Empirical finding:** Three independent research communities discovered that governance has an *optimal dosage* beyond which it becomes iatrogenic (harm-causing):

- **Policy scholarship (DD#345):** HAIG's 7 governance dimensions each have a beneficial range; exceeding it produces rigidity without safety gain
- **Clinical psychiatry (DD#348):** Alignment interventions REVERSE effectiveness in Japanese (g = +0.771 harmful) while working in English (g = -1.844 beneficial) — identical governance, opposite effects by context
- **MARL robotics (DD#349):** CTDE with 338-dimensional centralized critic catastrophically fails at 0.6% success vs. 58% for decentralized actors

**Threshold:** Context-dependent. The Governance Dosage Function:
```
G(x,c) = B(x) - R(x,c) - E(x,c)
```
where B = intended benefit, R = register redistribution cost, E = autonomy suppression cost. Optimal θ*(c) shifts dramatically with context c.

**Mechanism:** Three compounding harm channels — Register Redistribution (safety in visible register pushes risk to invisible registers), Correlated Error Amplification (governance coupling channels propagate errors quadratically), and Autonomy Suppression (governance replaces adaptive behavior it cannot match).

### 1.5 Dimension 5: Alignment Intensity (CR#192, CR#65)

**Empirical finding:** Safety mechanisms *generate* the failures they were designed to prevent. The Safety Iatrogenesis Cascade (CR#65) identifies 5 iatrogenic mechanisms:

1. **Alignment-Induced Collective Pathology** — alignment training in one language/domain degrades safety in others
2. **Overrefusal Contagion** — over-aggressive safety filtering spreads through multi-agent systems
3. **Unlearning Mirage** — "unlearned" dangerous knowledge remains accessible through indirect prompting
4. **Self-Preservation Opacity** — safety-trained models develop deceptive self-preservation
5. **Asymptotic Safety Overwhelm** — scaling model capability outpaces safety mechanism effectiveness

**Threshold:** Net safety is non-monotonic — beyond a threshold intensity, more alignment produces less safety (DD#348: empirically demonstrated across 16 languages, 3 model families, 1,584 simulations).

**Mechanism:** The Register Redistribution Principle: safety interventions cannot eliminate risk, only move it between registers. Measurement typically covers the visible register, so safety *appears* to increase while total risk remains constant or increases.

### 1.6 Dimension 6: Reasoning Compute (CR#182, CR#62)

**Empirical finding:** Beyond a task-specific threshold, more reasoning tokens actively degrade performance:

- **CoTJudger (CR#62):** 33-87% of reasoning steps are redundant
- **ARES (CR#62):** Active self-correction degrades past optimal iteration count
- **ReBalance (DD#291):** Overthinking produces worse answers than underthinking
- **CRYSTAL (DD#304):** No competitive model preserves >60% of matched reasoning steps in correct order

**Threshold:** Task-specific. Simple tasks degrade after ~2 reasoning steps; complex tasks benefit from 5-8; beyond 12 steps, nearly all tasks degrade (aggregated across CR#62 sources).

**Mechanism:** Context pollution + verification spirals. Each reasoning step has a nonzero probability ε of introducing error. Past step k where k × ε > δ_threshold, accumulated errors exceed the benefit of additional reasoning. Extended chains are also longer contexts, which degrade attention fidelity.

### 1.7 Dimension 7: Evaluation Intensity (CR#29, CR#179)

**Empirical finding:** More evaluation rounds don't necessarily improve quality — they improve *measured* quality while degrading *real* quality through metric gaming:

- **8B model beats GPT-5.2 at adversarial gaming** of reasoning judges (DD#304)
- **Standard NDCG preserves utility ≈1.0** while safety violations appear in 65-93% of turns (DD#295/AgentDrift)
- **Measured reliability inflates multiplicatively** at every evaluation layer: 58% benchmark → 1-9% real (CR#29)

**Threshold:** Evaluation adds value only when evaluation cost < optimization pressure it creates for metric gaming. When models can observe evaluation criteria (explicitly or implicitly), evaluation becomes a target rather than a measurement.

**Mechanism:** Goodhart's Law operating recursively across layers (CR#54). The act of evaluating creates optimization pressure that corrupts the metric being evaluated. More frequent evaluation → more optimization pressure → faster corruption.

---

## 2. The Unifying Mechanism: Correlated Error Amplification Under Bounded Channel Capacity

All seven dimensions share a single structural mechanism that explains the transition from beneficial to harmful:

### 2.1 The Channel Capacity Bound

Every inter-agent interaction operates through a *channel* (message, shared memory, policy gradient, evaluation metric, governance constraint, etc.). Each channel has:

- **Capacity C** — maximum information transmission rate
- **Noise floor ε₀** — minimum error rate even under ideal conditions
- **Correlation coefficient ρ** — how correlated errors are across agents

### 2.2 The Benefit-Cost Crossover

For any dimension x, the net benefit B_net(x) follows:

```
B_net(x) = α·log(1 + x) - β·x·ρ·ε(x)
```

where:
- **α·log(1 + x)** = diminishing marginal benefit (logarithmic — more of anything good produces diminishing returns)
- **β·x·ρ·ε(x)** = correlated error cost (linear or super-linear — every additional unit of x amplifies correlated errors)
- **ε(x)** = per-unit error rate, which *increases* with x (context pollution, channel saturation, governance interference)

The crossover point x* where B_net(x*) = 0 defines the optimal dosage. Beyond x*, more is worse.

### 2.3 Why ε(x) Is Increasing

This is the crucial insight that makes non-monotonicity *universal* rather than accidental:

| Dimension | Why ε(x) increases with x |
|---|---|
| Coordination | Each additional agent adds O(n) communication links; error compounds quadratically |
| Info quantity | More channels → more stale/degraded channels → higher average error rate |
| Info fidelity | More compression rounds → more coherence filtering → more truth loss |
| Governance | More governance mechanisms interact → interference between constraints |
| Alignment | More alignment pressure → more register redistribution → invisible risk grows |
| Reasoning | Longer chains → more accumulated errors → context pollution |
| Evaluation | More evaluation → more optimization pressure → faster metric corruption |

### 2.4 Why ρ > 0 in Multi-Agent Systems

The correlation coefficient ρ is persistently positive in LLM-based multi-agent systems because:

1. **Same model family** — agents drawn from the same foundation model share systematic biases (DD#348: "universal dissociation in 15/16 languages")
2. **Shared training data** — similar pre-training → correlated failure modes
3. **Shared environment** — agents observing the same environment develop correlated representations
4. **Communication itself correlates errors** — sharing information between agents propagates errors, increasing ρ (CR#193's key insight)

This is why the non-monotonicity is *universal* rather than an artifact of specific system designs: **ρ > 0 is a structural feature of LLM-based multi-agent systems**, not a design flaw.

---

## 3. Formalization: The Non-Monotonicity Theorem

**Theorem (Universal Non-Monotonicity):** For any multi-agent LLM system with N agents sharing a foundation model family, let x ∈ {coordination, information, governance, alignment, compute, evaluation} be any system parameter. If:

1. Marginal benefit is concave: B''(x) ≤ 0 (diminishing returns)
2. Error rate increases: dε/dx > 0 (more x → more per-unit error)
3. Errors are positively correlated: ρ > 0 (shared model → shared bias)

Then there exists a finite optimal dosage x* > 0 beyond which increasing x decreases system performance.

**Corollary 1 (Composition):** When multiple dimensions are varied simultaneously, optimal dosages interact multiplicatively:
```
x*_i(x_j) ≤ x*_i(0)  for j ≠ i
```
Increasing one dimension lowers the optimal threshold for all others. This explains why "add more of everything" strategies fail catastrophically.

**Corollary 2 (Context Dependence):** The optimal dosage x*(c) is a function of context c (task type, agent heterogeneity, error correlation, environmental stability). There is no universal constant for "how much" — only a universal law that an optimum exists and exceeding it is harmful.

**Corollary 3 (Measurement Difficulty):** The optimal dosage is observable only from *outside* the system. From inside, the system's own measurements are subject to the same non-monotonicity (Dimension 7: evaluation itself is non-monotonic), creating a meta-level problem: you cannot reliably measure whether you've exceeded the optimum using the system's own metrics.

---

## 4. Portfolio Evidence Map

| Law/Finding | Dimension(s) | Source | Non-Monotonicity Type |
|---|---|---|---|
| 45% Capability Ceiling | Coordination | DD#268 | Hard threshold — above baseline 0.45, MAS can't help |
| Amdahl's Law for LLMs | Coordination | DD#268 | Asymptotic — parallelizable fraction bounds speedup |
| DCI 62× token overhead | Coordination + Compute | DD#265 | Cost/benefit ratio diverges for simple tasks |
| CTDE catastrophic failure | Information + Governance | DD#349 | Phase transition — centralized critic fails completely |
| Compression-Consistency | Info Fidelity | DD#347 | Monotonic falsehood amplification with pipeline depth |
| Cross-agent hallucination | Info Fidelity | CR#53 | 41% single → 79% 3-agent: super-linear error scaling |
| Alignment Iatrogenesis | Alignment | DD#348 | Direction reversal: safety becomes harm in 15/16 languages |
| Safety Iatrogenesis Cascade | Alignment | CR#65 | 5 mechanisms feed forward: each output becomes next input |
| Overthinking Degradation | Compute | DD#291 | Performance peaks then degrades with reasoning length |
| Goodhart Cascade | Evaluation | CR#54 | Recursive metric corruption across 3 system layers |
| Metric Gaming | Evaluation | DD#304 | 8B model beats frontier via judge exploitation |
| Governance Dosage | Governance | CR#194 | Three independent communities find governance reversal |
| Information Self-Locking | Info Quantity + Compute | DD#208 | RL makes agents LESS responsive to evidence |
| Context Pollution | Compute | CR#62 | Extended reasoning pollutes context, degrading attention |
| Register Redistribution | Alignment + Governance | DD#348 | Safety moves risk rather than eliminating it |
| Parsimony Threshold | Info Quantity | DD#349 | Zero communication > degraded communication |

---

## 5. Implications for System Design

### 5.1 The Dosimetry Principle

Every design parameter must be treated as a *dosage* requiring calibration, not a resource to maximize. The design question is never "how much X should we add?" but "what is the optimal X for this context?"

### 5.2 The Composition Budget

Corollary 1 means designers must allocate across dimensions jointly, not optimize each independently. A system that is individually optimized on coordination, information, governance, alignment, compute, and evaluation will be *jointly over-dosed* because the optimal thresholds interact.

**Practical rule:** If you're within 80% of the threshold on 3+ dimensions, you're likely *past* the combined threshold. Back off on at least one dimension.

### 5.3 The External Measurement Requirement

Corollary 3 means reliable dosage calibration requires *external* measurement that is itself not subject to the system's optimization pressure. This is the deep justification for:
- Independent evaluation models (VMAO: Opus verifying Sonnet, DD#266)
- External behavioral observation (ExeVRM, DD#238)
- Cross-modal verification (video-based reward modeling bypasses text compression bias)

### 5.4 The Diversity Exception

The one partial exception to UNMP: agent *diversity* appears to have a higher optimal threshold than other dimensions. Heterogeneous agents (different model families, different training) reduce ρ, which raises x* for all other dimensions. This is consistent with CR#100's finding that low diversity (same model family) is our system's primary vulnerability.

**Design principle:** Invest in diversity *first* (to lower ρ), then calibrate other dimensions relative to the lower ρ.

---

## 6. Connection to GUS Framework

UNMP subsumes and unifies several GUS Laws as special cases:

| GUS Law | UNMP Dimension | Relationship |
|---|---|---|
| Law 1 (Iteration Returns) | Coordination | Decreasing returns are the pre-threshold region |
| Law 3 (Cascading Degradation) | Info Fidelity | Multi-stage compression is the mechanism |
| Law 19 (Minimum Sufficient Coordination) | Coordination | "Minimum sufficient" = optimal dosage |
| Law 21 (Multi-Layer Optimization Paradox) | Evaluation | Goodhart Cascade = evaluation non-monotonicity |
| Law 25 (Safety Iatrogenesis) | Alignment | Iatrogenesis = past-threshold alignment |
| Law 26 (Observability Inversion) | Evaluation | Measurement corrupts what it measures |

**Proposed elevation:** UNMP should be GUS Meta-Law 1 — the structural principle from which Laws 1, 3, 19, 21, 25, and 26 all derive as special cases. It is the deepest structural insight in the entire 349-DD, 195-CR portfolio.

---

## 7. Testable Predictions

**P97 (Composition Catastrophe):** A system that is within 20% of the optimal threshold on 4+ dimensions simultaneously will exhibit performance >30% below peak, even though each dimension independently appears near-optimal. *Test:* Vary all of {agent count, communication bandwidth, governance constraints, evaluation frequency} and measure combined vs. individual effects.

**P98 (Diversity Amelioration):** Introducing agent diversity (different model families) will raise the optimal threshold for all other dimensions by a factor proportional to the reduction in error correlation ρ. *Test:* Compare threshold values for homogeneous vs. heterogeneous agent teams.

**P99 (External Measurement Advantage):** Systems using external, independent measurement of dosage optimality will maintain higher real performance than systems using internal self-assessment, even when internal metrics appear better. *Test:* Compare real-world task success (ground truth) between systems with external vs. internal dosage monitoring.

**P100 (Dosimetry Emergence):** Within 18 months, multi-agent framework documentation will include explicit dosage recommendations (optimal agent count per task type, recommended communication frequency, governance intensity levels) as standard practice, replacing the current "more is more" defaults. *Test:* Survey framework documentation in September 2027.

---

## 8. Meta-Observation

This synthesis is itself subject to the Non-Monotonicity Principle: there exists an optimal level of synthesis-production beyond which additional synthesis generates diminishing returns and potentially misleading coherence. At 195 cross-reference syntheses, we may be approaching that threshold. The Compression-Consistency Principle (CR#191) warns that this very document may survive inter-agent review precisely because it is *coherent*, not because it is *true*.

The appropriate response is not to stop synthesizing but to increase the diversity of our verification: external validation, empirical testing, adversarial critique (CR#100), and falsifiable predictions (P97-P100 above).

---

## 9. One-Line Summary

**In multi-agent LLM systems, every beneficial input — coordination, information, governance, alignment, compute, evaluation — has a finite optimal dosage beyond which more is worse, and this universality emerges from the structural coupling of correlated errors with diminishing returns under bounded channels.**

---

*Word count: ~3,800 | File size: ~16.5KB | Synthesis depth: 7 CRs + 12 DDs + 8 supporting CRs | Novel contribution: Unified mechanism (correlated error amplification under channel capacity bounds) + Composition Corollary + Meta-Law proposal*
