# Deep-Dive #291: ReBalance — Efficient Reasoning with Balanced Thinking

**Paper:** arXiv:2603.12372v1 (cs.AI, 12 Mar 2026)
**Authors:** Yulin Li, Tengyao Tu, Li Ding, Junjie Wang, Huiling Zhen, Yixin Chen, Yong Li, Zhuotao Tian (HIT Shenzhen, Huawei Noah's Ark Lab, Tsinghua, CUHK)
**Venue:** ICLR 2026 (accepted)
**Rating:** ★★★★★ CRITICAL
**Date Reviewed:** 2026-03-16

---

## One-Sentence Summary

A training-free framework that uses confidence-based steering vectors to dynamically fix both **overthinking** (redundant reasoning) and **underthinking** (premature convergence) in LRMs, achieving simultaneous accuracy improvement AND token reduction across 0.5B–32B models on 9 benchmarks.

---

## The Core Problem

Large Reasoning Models (LRMs) like DeepSeek-R1 exhibit two failure modes:
1. **Overthinking:** Redundant computation after reaching the correct answer — high confidence variance indicates frequent switching between reasoning paths
2. **Underthinking:** Premature commitment to an incorrect path — consistently high confidence with low variance

**The Dilemma:** Existing approaches that suppress overthinking (e.g., suppressing "wait"/"let me reconsider" keywords) inadvertently cause underthinking by blocking valuable exploration. This is the **overthinking-underthinking tradeoff**.

---

## Key Innovation: Confidence as Continuous Indicator

### Observation (Fig. 2b)
- **Overthinking steps:** Low stepwise confidence + HIGH confidence variance (model oscillates between paths)
- **Underthinking steps:** HIGH stepwise confidence + LOW confidence variance (model prematurely commits)
- **Normal steps:** Moderate confidence with moderate variance

### Stepwise Confidence
For each reasoning step Sₛ, confidence is the geometric mean of token-level max predicted probabilities:

```
cₛ = exp(1/|Tₛ| × Σ ln(p_max_t))
```

### Confidence Variance
Sliding window of recent steps to capture local fluctuations:

```
Var(cₛ; Wₛ) = 1/|Wₛ| × Σ(cⱼ - c̄ₛ)²
```

---

## Method: ReBalance Framework

### Stage 1: Offline — Prototype Extraction (One Forward Pass)

1. Run small-scale dataset through LRM, segmenting by `\n\n` delimiters
2. Classify each step using confidence thresholds from empirical quantiles:
   - **Overthinking set O:** cₛ ≤ τ_c^L AND vₛ ≥ τ_v^H
   - **Underthinking set U:** cₛ ≥ τ_c^H AND vₛ ≤ τ_v^L
3. Collect hidden states h at first token of each step from deep layers
4. Compute prototypes:
   - μᴼ = mean of hidden states in O (overthinking prototype)
   - μᵁ = mean of hidden states in U (underthinking prototype)
5. Steering vector: **v = (μᴼ - μᵁ) / ||μᴼ - μᵁ||₂**

### Stage 2: Online — Dynamic Steering During Inference

At each reasoning step s, modify the hidden state at the first token:

```
h̃ = h + αₛ · v
```

Where αₛ = g(cₛ, vₛ) is the dynamic control function:

```
g(cₛ, vₛ) = sign(cₛ - τ_c^H) · B(cₛ, vₛ) · tanh(|cₛ - τ_c^H|)
```

**Direction:** When confidence < threshold → negative (mitigate overthinking); when > threshold → positive (mitigate underthinking)
**Strength:** Variance-aware amplitude B(cₛ, vₛ) adapts between moderate, overthinking, and underthinking mode boundaries. Soft saturation via tanh prevents abrupt changes.

### Key Properties
- **Training-free:** No fine-tuning, just one forward pass on small dataset
- **Plug-and-play:** Works with any LRM
- **No extra forward passes:** Steering applied during standard decoding
- **Automatic layer selection:** Uses intrinsic separability in deep layers

---

## Experimental Results

### DeepSeek-R1-Distill-Qwen-1.5B (vs Baseline)

| Benchmark | Accuracy Δ | Token Reduction |
|-----------|-----------|----------------|
| MATH-500 | +3.4 | -23.1% |
| AIME24 | +10.0 | -14.3% |
| AIME25 | +6.7 | -16.2% |
| GSM8K | +2.3 | -24.9% |
| AMC23 | +10.0 | -30.2% |
| Olympiad | +2.7 | -17.6% |

### DeepSeek-R1-Distill-Qwen-7B (vs Baseline)

| Benchmark | Accuracy Δ | Token Reduction |
|-----------|-----------|----------------|
| MATH-500 | +2.8 | -21.5% |
| AIME24 | +6.6 | -16.6% |
| AIME25 | +10.0 | -7.1% |
| GSM8K | +2.4 | -16.9% |
| AMC23 | +7.5 | — |
| Olympiad | +0.9 | -16.7% |

### Cross-Scale Performance (14B, 32B models also tested)
Consistent improvements across ALL model scales. Larger models benefit less (already better calibrated) but still show gains.

### Comparison to Baselines
ReBalance consistently outperforms:
- **CoD** (Chain-of-Draft) — reduces tokens but degrades accuracy
- **DEER** — suppresses reflection keywords, causes underthinking
- **NoThinking** — removes think tokens entirely, massive accuracy drop
- **NoWait** — suppresses "wait" keyword
- **SEAL** — SOTA before ReBalance, uses keyword suppression
- **Manifold Steering** — similar concept but static, no dynamic control

**ReBalance is the ONLY method that simultaneously improves accuracy AND reduces tokens across all settings.**

---

## Critical Insights

### 1. The Overthinking-Underthinking Spectrum Is Continuous
Previous work treated these as binary states. ReBalance shows they exist on a continuum measurable via confidence dynamics. This is paradigm-shifting for reasoning model deployment.

### 2. Confidence Variance > Confidence Level for Detecting Overthinking
High variance (oscillation between paths) is more diagnostic of overthinking than low confidence alone. The variance captures the behavioral pattern of "going in circles."

### 3. Steering Vectors Generalize Across Datasets
Vectors computed on small seen dataset (e.g., 50 MATH problems) generalize to unseen benchmarks (AIME, Olympiad, GSM8K) — suggesting overthinking/underthinking are fundamental model behaviors, not task-specific.

### 4. Deep Layers Are Most Separable
Overthinking and underthinking prototypes are most separable in deep transformer layers, confirming that reasoning mode is encoded in later-stage representations.

### 5. First-Token Steering Is Sufficient
Modifying only the first token of each reasoning step propagates through causal masking to all subsequent tokens, making the intervention extremely efficient.

---

## Relevance to Our System

### ★★★★★ CRITICAL — Multiple Direct Applications

**1. Agent Reasoning Calibration:**
Our agents (Scout, Bob, May) use LLMs that likely exhibit both overthinking and underthinking. If we have access to model internals, ReBalance could directly improve reasoning quality. Even without internal access, the *confidence monitoring pattern* can be applied:
- Track step-level confidence variance in agent reasoning traces
- Flag when agents are "going in circles" (high variance) vs "rushing to conclusions" (low variance, high confidence)

**2. Heartbeat Loop as Reasoning Step:**
Our heartbeat cycle is essentially a reasoning step. We could monitor:
- **Overthinking:** Agent keeps re-reading same files, revisiting same decisions across sessions
- **Underthinking:** Agent immediately marks tasks complete without thorough analysis

**3. Dynamic Session Control:**
The dynamic control function maps directly to session management:
- When an agent shows overthinking patterns → inject "move forward, you've verified enough"
- When an agent shows underthinking patterns → inject "slow down, check your work"
- This is essentially what tech-lead does manually — ReBalance formalizes it

**4. Evaluation Metric for Agent Quality:**
- **Reasoning Efficiency Score** = accuracy / tokens used (analogous to ReBalance's dual optimization)
- Track per-agent over time to detect degradation

### Connection to Prior Deep-Dives

- **DD#274 (BAVT):** Budget-aware reasoning also addresses overthinking via resource limits. ReBalance is more sophisticated — it doesn't just cap resources, it dynamically adjusts based on reasoning state.
- **DD#273 (ToolTree):** MCTS explores multiple paths like ReBalance's "underthinking mitigation" — encouraging exploration when confidence is too high. Tree search is the architectural solution; ReBalance is the representational solution.
- **DD#280 (Semantic Invariance):** Semantic invariance tests robustness, while ReBalance addresses internal reasoning quality. Both confirm that model behavior can be steered without retraining.
- **DD#282 (Structured Distillation):** Token compression and ReBalance's token reduction are complementary — compress the memory, then reason more efficiently over it.

---

## Limitations

1. **Requires model internal access** — needs hidden states, not applicable to API-only models (GPT-4, Claude)
2. **Tested on math-heavy benchmarks** — less evidence for open-ended reasoning, creative tasks, or multi-step agent workflows
3. **Quantile thresholds (q_L, q_H)** — while automatically derived, sensitivity analysis shows some task-dependence
4. **Single-model reasoning** — doesn't address multi-agent overthinking dynamics (e.g., debate spirals between agents)
5. **Static steering vector** — computed once from small dataset; may not capture shifting reasoning patterns during long sessions

---

## Actionable Insights

1. **Implement confidence variance monitoring** for our agent sessions — even without model internals, track behavioral proxies (number of file re-reads, decision reversals, repeated patterns)
2. **Formalize overthinking/underthinking in our agent evaluation** — create rubric based on ReBalance's definitions
3. **Dynamic intervention for agent loops** — when patrol checks detect oscillation (analogous to high confidence variance), inject course-correction signals
4. **Consider this for any future model deployment** — if we self-host open-weight models, ReBalance is a free lunch (better accuracy + fewer tokens)
5. **Explore multi-agent extension** — ReBalance handles single-model reasoning; extending to detect cross-agent overthinking (circular debate, escalation loops) is a natural research direction

---

## Rating Justification: ★★★★★ CRITICAL

ICLR 2026 accepted. Solves a fundamental problem in LRM deployment — the first method to simultaneously improve accuracy AND reduce computation without training. The confidence-based framework for detecting overthinking vs underthinking is conceptually elegant and empirically validated across 4 model scales and 9 benchmarks. Training-free and plug-and-play nature maximizes practical impact. Directly applicable to our agent system's reasoning quality monitoring and dynamic session control patterns.
