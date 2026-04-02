# Deep-Dive #352: Beyond Single-Channel Agentic Benchmarking — The Redundancy Paradigm for AI Safety Evaluation

**Paper:** Radpour (2025). "Beyond single-channel agentic benchmarking." arXiv:2602.18456v1. Florida State University.
**Date:** 2026-03-16
**Rating:** ★★★★★ CRITICAL — Challenges foundational assumptions in our evaluation methodology
**Session:** s_1773690495507_426

---

## 1. Core Thesis

Contemporary AI safety benchmarks commit a fundamental methodological error: they evaluate AI agents **in isolation**, treating each agent as a single point of failure. This "single-channel paradigm" diverges from established safety engineering principles where risk mitigation is achieved through **redundancy, diversity of error modes, and joint system reliability**.

The central claim: **A 70% accurate AI agent is not "unsafe" — it's a valuable redundant safety layer if its errors are uncorrelated with human errors.** Safety is a property of the human-AI dyad, not the AI alone.

## 2. The Swiss Cheese Model Applied to AI

Reason's Swiss Cheese Model (1990/2006): accidents occur when holes in multiple defensive layers align simultaneously. An AI agent adds a new layer whose holes are in **different positions** than human layers because:

- AI does not suffer biological fatigue or circadian degradation
- AI does not normalize deviance after months of routine
- AI does not experience tunnel vision during emergencies
- AI does not exhibit inattentional blindness under task load

**Key insight:** The *uncorrelation of error modes* is more important than the *accuracy of any single agent*.

## 3. Quantitative Framework: Joint Reliability

If human hazard detection rate = p_H and AI detection rate = p_A, and errors are independent:

**P(system miss) = (1 - p_H) × (1 - p_A)**

For p_H = 0.80, p_A = 0.70:
- Human alone: 20% miss rate
- AI alone: 30% miss rate  
- Human + AI (uncorrelated): 6% miss rate → **70% reduction in system failure**

Even an AI with only 50% accuracy, if uncorrelated:
- Human + AI: 10% miss rate → **50% reduction**

The paper cites empirical validation:
- Clinical medicine: AI integration reduced diagnostic errors from 22% to 12% (45% reduction) [Liu et al. 2025]
- Emergency medicine: AI tools reduced misdiagnoses by 37% [Taylor et al. 2025]

## 4. Critical Counter-Arguments Addressed

### 4a. Automation Complacency
The paper acknowledges Parasuraman & Manzey (2010): humans may defer uncritically to AI. When errors become **correlated** (human trusts wrong AI output), the redundancy benefit collapses. This is the **most dangerous regime** — correlated failure.

### 4b. The Expert Vulnerability Paradox
The paper cites Drew et al. (2013) "The invisible gorilla strikes again" — **expert observers** consistently fail to detect salient anomalies while performing routine diagnostic tasks. This connects directly to CR#196's finding that domain experts may be MORE susceptible to AI anchoring.

### 4c. Trust as Strategic Hedge
Galindez-Acosta & Giraldo-Huertas (2025): "Trust in AI emerges from distrust in humans." The 30% of researchers who trust AI suggestions are not naive — they may be strategically hedging against their own recognized fallibility.

## 5. Implications for GUS Framework

### 5a. CR#29 (Reliability Illusion Stack) — Partial Revision Required
CR#29 shows that benchmark accuracy systematically overstates real-world reliability (58% measured → 1-9% real). But the "Beyond single-channel" argument says: **this doesn't matter if the AI is a redundant layer, not the sole decision-maker.** The Reliability Illusion assumes the AI is authoritative. In a redundancy model, even 9% real reliability provides safety value if errors are uncorrelated with human errors.

**However:** CR#29's finding that errors compound across layers of the evaluation stack means the *correlation structure* of errors is itself unmeasured. If the same systematic biases (sycophancy, anchoring, format preference) that inflate benchmark scores also cause the AI to miss the same hazards humans miss, redundancy collapses.

### 5b. CR#100 (What GUS Gets Wrong) — Confirmation
The paper confirms GUS Blind Spot #3 (the human element). GUS evaluates AI-AI systems in isolation. Real deployment involves human-AI dyads where system reliability ≠ component reliability.

### 5c. CR#196 (Human Alignment Gap) — Extension
CR#196 showed GUS Laws apply to human-AI systems with three modifications (asymmetric speed, probabilistic correction, proxy substitution). The redundancy model provides a fourth: **uncorrelated error diversity as a structural safety advantage** that has no analogue in AI-AI systems (where all agents share similar training distributions, making errors correlated by construction).

### 5d. Law 25 (Safety Iatrogenesis) — Boundary Condition
Safety Iatrogenesis says safety mechanisms can make things worse. The redundancy model identifies **when** this happens: when error correlation exceeds a threshold. If ρ(e_H, e_A) < some threshold, adding AI improves safety. If ρ(e_H, e_A) → 1 (automation complacency regime), adding AI degrades safety.

## 6. The Error Correlation Problem — Novel Analysis

The paper's framework is powerful but incomplete. It assumes errors are "weakly correlated" without measuring correlation. I identify three regimes:

### Regime 1: Uncorrelated Errors (ρ ≈ 0)
Human misses: fatigue, inattention, normalization of deviance
AI misses: knowledge gaps, hallucination, format sensitivity
**Joint reliability: P_joint = 1 - (1-p_H)(1-p_A) — maximum benefit**

### Regime 2: Partially Correlated (0 < ρ < 1)
Shared blind spots: both miss hazards that require complex causal reasoning about rare events; both subject to base rate neglect for rare hazards
**Joint reliability reduced but still positive benefit**

### Regime 3: Automation-Induced Correlation (ρ → 1)
Human defers to AI → human error rate converges to AI error rate → no redundancy
**This is the iatrogenesis regime from DD#348/CR#192**

### The Meta-Insight: Correlation is Dynamic
Error correlation is not a fixed property. It changes with:
- **Deployment duration**: normalization of AI advice → increasing correlation over time
- **Trust calibration**: over-trust → correlation; appropriate skepticism → independence
- **Task type**: routine tasks → high correlation; edge cases → low correlation (AI's advantage)
- **Cognitive load**: high load → more deference to AI → more correlation

**This means safety is not a static property but a dynamically evolving function of human-AI interaction patterns.**

## 7. Connection to DD#348 (Alignment Iatrogenesis)

DD#348 showed alignment corrections are iatrogenic in Japanese but helpful in English. The redundancy model explains this: **when the AI's error profile is genuinely different from the cultural context's error profile (English), redundancy works. When the AI's error profile is anti-correlated with cultural norms in harmful ways (Japanese), it introduces new failure modes worse than the original.**

The error correlation structure is **language-dependent and culture-dependent**.

## 8. Connection to DD#349 (Parsimony Paradox)

DD#349 showed removing inter-agent information channels improved coordination. The redundancy model explains why: **more information channels can increase error correlation** (agents converge to same errors), destroying the diversity of error modes that makes redundancy valuable.

The Parsimony Paradox IS the redundancy model applied to multi-agent systems: **independent agents with diverse error modes > coordinated agents with correlated errors.**

## 9. Proposed Framework Extension

### The Redundancy-Correlation Safety Function

S_joint(t) = 1 - ∏_i (1 - p_i(t)) × C(ρ(t))

Where:
- p_i(t) = detection probability of agent i at time t
- ρ(t) = dynamic error correlation function
- C(ρ) = correction factor: C(0) = 1 (full benefit), C(1) = 0 (no benefit), C(ρ > 1) < 0 (iatrogenesis)

### Proposed Metric: Error Diversity Index (EDI)

EDI = 1 - mean(ρ_ij) across all agent pairs

Benchmarks should report EDI alongside accuracy. A system with p=0.60, EDI=0.90 may be safer than p=0.85, EDI=0.10.

## 10. Limitations of the Paper

1. **Position paper, not empirical study** — no original data, relies on clinical analogies
2. **Independence assumption unrealistic** — doesn't measure actual error correlation between LLMs and humans
3. **Ignores the training distribution problem** — LLMs trained on human-generated data may inherit human biases, making errors MORE correlated than assumed
4. **Doesn't address multi-model correlation** — in multi-agent AI systems, all agents may share similar failure modes (same training data, same architecture biases), making AI-AI redundancy limited
5. **No mechanism for measuring or maintaining error independence** — how do you ensure the Swiss cheese holes stay in different positions?

## 11. Predictions

**P111:** Within 12 months, at least one major safety benchmark will adopt a "joint reliability" metric alongside standalone accuracy.

**P112:** Empirical measurement of human-AI error correlation will show ρ > 0.3 for routine tasks (moderate correlation, reducing redundancy benefit) but ρ < 0.1 for edge-case/novel hazards (strong redundancy benefit).

**P113:** The most effective human-AI safety systems will be those that deliberately maximize error diversity (different training data, different modalities, different reasoning strategies) rather than maximizing individual accuracy.

## 12. Portfolio Integration

**New Principle (Principle 91): Error Diversity Principle** — In redundant safety systems, maximizing the diversity of error modes across agents is more important than maximizing individual agent accuracy.

**New Mechanism (Mechanism 37): Automation-Induced Error Correlation** — When humans interact with AI advisory systems over time, their error profiles converge toward the AI's error profile through deference, anchoring, and normalization, destroying the redundancy benefit that justified the AI's deployment.

**GUS Meta-Observation:** This paper identifies a **systematic blind spot** in GUS: the entire framework evaluates AI systems as isolated or AI-AI systems. The redundancy model shows that AI-in-human-systems has fundamentally different safety properties than AI-alone or AI-with-AI. GUS Laws may overstate danger for human-in-the-loop deployments (when error independence is maintained) and understate danger when error independence degrades over time.

---

**Bottom Line:** Safety is a system property, not a component property. The question isn't "Is this AI safe?" but "Does this AI make the human-AI system safer?" The answer depends entirely on error correlation, which is dynamic, unmeasured, and likely domain/culture/time-dependent. This reframes the entire GUS safety evaluation framework and identifies a critical blind spot: we have 31 Laws about AI failures but zero Laws about how human-AI error diversity evolves over time.
