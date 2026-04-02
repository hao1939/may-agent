# DD#356: ProxMO — Proximity-Based Multi-Turn Optimization for LLM Agent Credit Assignment

**Paper:** arXiv:2602.19225 — "Proximity-Based Multi-Turn Optimization: Practical Credit Assignment for LLM Agent Training"  
**Authors:** Yangyi Fang¹*, Jiaye Lin¹*, Xiaoliang Fu²*, Cong Qin³, Haolin Shi¹, Chang Liu⁴, Peilin Zhao⁵⁶†  
**Institutions:** ¹Tsinghua University, ²Fudan University, ³Peking University, ⁴Lanzhou University, ⁵Tencent Inc., ⁶Shanghai Jiao Tong University  
**Submitted:** 2026-02-22  
**Rating:** ★★★★★ CRITICAL — First hierarchical credit assignment framework for multi-turn LLM agent training that resolves two fundamental GRPO limitations (context-blind normalization and singleton degeneracy) with negligible computational overhead (+1.09%), achieving +28.9% over GRPO on ALFWorld and +13.8% on WebShop

---

## 1. Core Problem: Credit Assignment in Multi-Turn Agent Training

**GRPO (Group Relative Policy Optimization) has two structural blind spots when applied to multi-turn agent tasks:**

### 1.1 Episode-Level: Context-Blind Normalization

Standard GRPO computes advantages via z-score normalization within sampled trajectory groups:

```
A^E(τ_i) = (R(τ_i) - μ) / σ
```

**The problem:** Identical z-scores produce identical advantage magnitudes regardless of task difficulty. A failure on a task with 75% success rate (likely noise) receives the same penalty magnitude as a failure on a 25% success rate task (potentially signal). Conversely, a success on a hard task (genuine capability breakthrough) gets the same reward as a success on an easy task (routine performance).

**This is exactly the Information Self-Locking mechanism (DD#208) applied to training!** The agent can't distinguish signal from noise in its own learning signal, so it updates equally for informative and uninformative episodes.

### 1.2 Step-Level: Singleton Degeneracy

Existing step-level methods (e.g., GiGPO) use hard boundary partitioning — exact state matching or similarity thresholds to group steps:

- **Strict criteria → singleton groups:** In complex environments, few states exactly match, so most groups contain a single state. Normalization becomes undefined (division by zero variance).
- **Loose criteria → equal weighting:** All states in a cluster get equal weight regardless of semantic proximity, treating a near-exact match the same as a barely-qualifying distant match.

**This is an irresolvable trade-off in discrete grouping approaches.** The step-level information is either completely lost (singletons) or severely degraded (equal weighting).

---

## 2. ProxMO Architecture: Two-Level Context Integration

### 2.1 Episode-Level: Polarized Signal Controller (PSC)

**Key idea:** Scale gradient intensity based on task difficulty (empirical success rate p):

```
w(R, p) = 1 + β · f(R, p)

f(R, p) = {
  Sigmoid(d/α) - 0.5,  if R = 1 (success)
  Sigmoid(-p/α) - 0.5, if R = 0 (failure)
}
```

Where d = 1-p (failure rate), α controls steepness, β controls modulation strength.

**Effect:**
- **Successes amplified in low-success groups** (rare breakthroughs get stronger learning signal)
- **Failures attenuated in high-success groups** (noise penalties reduced)
- **Critical asymmetry:** This explicitly encodes that "surprising" outcomes carry more information than "expected" ones — a form of information-theoretic weighting

**Connection to our portfolio:** This is the first concrete implementation of what CR#62 (Reasoning Compute Allocation) called "allocation quality dominates compute quantity" — applied to training signal rather than inference compute.

### 2.2 Step-Level: Proximity-Based Soft Aggregation (PSA)

**Key idea:** Replace discrete groups with continuous semantic weighting. Every state contributes to every other state's baseline, weighted by semantic proximity:

```
B_t^(i) = Σ_{j∈G(i)} w_ij · R_t^(j)

w_ij = exp(sim(s_t^(i), s_t^(j)) / τ) / Σ_k exp(sim(s_t^(i), s_t^(k)) / τ)
```

Where similarity is computed via TF-IDF vectors (lightweight, no neural forward pass).

**Temperature τ controls the spectrum:**
- τ → 0: Concentrates on nearest neighbor (≈ exact matching)
- τ → ∞: Uniform weighting (≈ episode-level baseline)
- τ = 0.1 (optimal): Balances proximity sensitivity and stability

**This eliminates singleton degeneracy entirely** — every state has a well-defined soft baseline regardless of how unique it is.

### 2.3 Unified Objective

```
A(a_t^(i)) = Ã^E(τ_i) + ω · A^S(a_t^(i))
```

Combined with standard clipped PPO + KL penalty against reference policy:

```
J(θ) = E[min(ρ·A, Clip(ρ, 1±ε)·A)] - β_KL · D_KL(π_θ || π_ref)
```

**Key property:** Both PSC and PSA are lightweight arithmetic operations — no additional neural networks or model forward passes. Total overhead: +1.09% training time.

---

## 3. Empirical Results

### 3.1 Main Performance

| Model | Method | ALFWorld (All) | WebShop (Score) | WebShop (Succ.) |
|-------|--------|----------------|-----------------|-----------------|
| Qwen2.5-1.5B | Base | 4.1% | 25.1% | 6.3% |
| Qwen2.5-1.5B | GRPO | 70.3% | 73.1% | 52.2% |
| Qwen2.5-1.5B | GiGPO | 85.2% | 81.7% | 62.3% |
| Qwen2.5-1.5B | **ProxMO** | **90.6%** | **85.3%** | **67.1%** |
| Δ vs GRPO | | **+28.9%** | **+16.7%** | **+28.5%** |
| Qwen2.5-7B | GRPO | 79.8% | 79.2% | 67.2% |
| Qwen2.5-7B | GiGPO | 89.5% | 85.5% | 74.8% |
| Qwen2.5-7B | **ProxMO** | **94.5%** | **87.2%** | **76.5%** |
| Δ vs GRPO | | **+18.4%** | **+10.1%** | **+13.8%** |

**Critical finding:** 1.5B ProxMO (90.6% ALFWorld) **surpasses GPT-4o (48.0%) and Gemini-2.5-Pro (60.3%)** — a 1.5B model with proper credit assignment beats 100x+ larger models with generic prompting.

### 3.2 Task-Specific Analysis

The gains are **highly non-uniform** across task types:

| Task Type | GRPO (1.5B) | ProxMO (1.5B) | Relative Gain |
|-----------|-------------|---------------|---------------|
| Pick (simple) | 80.0% | 94.3% | +17.9% |
| **Look (long-horizon)** | **50.0%** | **92.9%** | **+85.8%** |
| Clean | 75.0% | 89.3% | +19.1% |
| Heat | 88.9% | 92.2% | +3.7% |
| **Cool (long-horizon)** | **63.2%** | **89.5%** | **+41.6%** |
| **Pick2 (hardest)** | **50.0%** | **87.0%** | **+74.0%** |

**Pattern:** The gains are largest on long-horizon, compositional tasks (Look: +85.8%, Pick2: +74.0%) and smallest on short, simple tasks (Heat: +3.7%). This is exactly what credit assignment theory predicts — the harder the task, the more credit assignment matters.

### 3.3 Ablation Results

- **PSC only (episode-level):** Moderate improvement; more impact on high-variance tasks
- **PSA only (step-level):** Larger improvement; critical for long-horizon tasks
- **Both (ProxMO):** Synergistic — exceeds additive expectation. Episode-level difficulty adaptation amplifies the value of step-level credit precision

### 3.4 Hyperparameter Robustness

ProxMO maintains high performance across broad parameter ranges:
- α ∈ [2, 8]: <3% variance
- β ∈ [0.05, 0.5]: <4% variance  
- τ ∈ [0.01, 1.0]: <5% variance (log scale)

**Same hyperparameters work across both 1.5B and 7B scales** — no scale-specific tuning needed.

---

## 4. Mechanistic Analysis

### 4.1 Why ProxMO Works: The Information Value Asymmetry

The core insight is that learning signals have context-dependent information value:

1. **High success rate + failure = noise** → Attenuate gradient (don't overfit to random failure)
2. **Low success rate + success = breakthrough** → Amplify gradient (consolidate rare capability)
3. **Similar states + different outcomes = discriminative signal** → Weight heavily in baseline computation
4. **Dissimilar states + same outcome = uninformative** → Weight lightly

This is fundamentally about **signal-to-noise ratio in the training gradient**, which connects directly to:
- **DD#208 (Information Self-Locking):** ProxMO breaks the self-locking mechanism by externally modulating gradient SNR rather than relying on the agent's own reasoning to allocate attention
- **DD#213 (SkillRL):** SkillRL's "abstract first, then RL" principle is complementary — ProxMO improves RL quality, SkillRL improves experience quality before RL

### 4.2 The Goal Drift Case Study

The paper provides a detailed case study of GPT-4o vs. ProxMO-trained 1.5B on a multi-object placement task:
- **GPT-4o (14 steps, FAILURE):** After finding first remote, hallucinates decision to store in cabinet "for safekeeping" instead of target armchair. Locally coherent, globally misaligned. Error cascades irrecoverably.
- **ProxMO 1.5B (11 steps, SUCCESS):** Systematically explores high-probability locations, immediately deposits at target. No goal drift.

**This is the clearest demonstration of the Compression-Truth Gap (DD#347) in action:** GPT-4o generates a "plausible" action (store for safekeeping) that is compressible/coherent but wrong, while the ProxMO-trained model has learned through precise credit assignment that goal-aligned actions are the only ones worth taking.

### 4.3 Computational Efficiency as Design Principle

The +1.09% overhead is not incidental — it's a design choice. ProxMO achieves its gains through:
- TF-IDF similarity (no neural forward passes)
- Scalar modulation functions (Sigmoid, normalization)
- Within-group aggregation (no cross-batch communication)

**This validates GUS Principle 38 (Cheap Signal Dominance):** The most effective improvements come from cheap, lightweight mechanisms that improve information quality rather than expensive architectural changes.

---

## 5. Portfolio Connections

### 5.1 Direct Connections

| Portfolio Entry | Connection |
|----------------|------------|
| **DD#208 (Information Self-Locking)** | ProxMO breaks self-locking by externally modulating gradient SNR — the agent doesn't need to assess its own learning signal quality |
| **DD#213 (SkillRL)** | Complementary: SkillRL abstracts experience → ProxMO improves credit assignment on that experience. SkillRL's raw-memory-RL trap (21.4% vs 14.8% base) may be partially a credit assignment failure |
| **CR#41 (RL Training Trap Taxonomy)** | ProxMO directly addresses Trap #1 (Information Self-Locking) and Trap #2 (Length Collapse — by properly crediting steps, not just episodes). Partially addresses Trap #3 (Reward Hacking — by attenuating noise signals) |
| **CR#62 (Reasoning Compute Allocation)** | Validates R1 (Allocation Dominance): 28.9% improvement from better credit allocation, not more compute |
| **DD#347 (Compression-Truth Gap)** | Goal drift case study demonstrates compression bias in action; ProxMO counteracts by training for goal-alignment over coherence |
| **GRPO Survey** | ProxMO is the first multi-turn-specific improvement to GRPO; directly extends the portfolio's GRPO thread |
| **DD#344 (MAGPO)** | Both operate on GRPO-family algorithms; MAGPO constrains inter-agent policy divergence while ProxMO improves single-agent training signal quality — potentially synergistic |

### 5.2 Key Tension

ProxMO assumes **binary rewards (R ∈ {0,1})** and tasks with estimable success rates. In production multi-agent systems:
- Rewards are often sparse, delayed, or partial
- Success rates fluctuate during training (non-stationary)
- Multi-agent credit assignment has an additional layer: attributing team outcomes to individual agents

**The multi-agent extension is non-trivial.** ProxMO's episode-level modulation needs a multi-agent equivalent that accounts for agent-specific difficulty, not just task-specific difficulty. This connects to the coordination cost overhead from DD#268 (LLM Teams as Distributed Systems) — in multi-agent settings, Amdahl's Law limits how much step-level credit assignment can help when coordination overhead dominates.

---

## 6. Assessment

### 6.1 Strengths
- **Elegant simplicity:** Two mechanisms, each addressing a clear limitation, with formal justification
- **Industrial viability:** +1.09% overhead, plug-and-play with GRPO frameworks, same hyperparameters across scales
- **Strong empirical signal:** 1.5B model beating GPT-4o/Gemini-2.5-Pro on structured tasks is remarkable
- **Principled information theory:** Correctly identifies that learning signal quality > quantity

### 6.2 Limitations
- **Binary reward assumption:** Episode-level PSC as formulated requires binary outcomes. Extension to continuous rewards needs validation
- **TF-IDF for similarity:** Adequate for ALFWorld/WebShop textual states but may not scale to visual or multimodal agent states
- **Only two benchmarks:** Both are structured interactive tasks. Generalization to open-ended, creative, or adversarial tasks is unknown
- **No multi-agent evaluation:** The paper focuses on single-agent training. Multi-agent credit assignment is a different, harder problem

### 6.3 Significance for GUS Framework

**ProxMO provides the first concrete, validated mechanism for breaking Information Self-Locking (DD#208) during training** — external modulation of gradient SNR based on episode difficulty and step proximity. This suggests that the Self-Locking trap (one of the most fundamental in the RL Training Trap Taxonomy, CR#41) is not fundamental but structural: it can be broken with cheap external signal processing.

**Proposed additions:**
- **Mechanism 41: Context-Blind Credit Misallocation** — When training signals are normalized without context (task difficulty, step proximity), agents systematically over-learn from noise and under-learn from breakthroughs, producing policies that are robust on easy tasks but fragile on hard ones
- **Principle 100: Hierarchical Credit Precision** — In multi-turn agent training, credit assignment must operate at both episode (difficulty-weighted) and step (proximity-weighted) levels; either alone is insufficient
- **Prediction P128:** ProxMO-style credit assignment + SkillRL-style experience abstraction will combine super-additively, because one improves input quality while the other improves gradient quality

---

## 7. Key Takeaway

**Credit assignment quality in multi-turn training is a more important lever than model scale, benchmark difficulty, or training compute — proper credit assignment allows a 1.5B model to outperform 100x+ larger models.** This is the training-time analog of the inference-time insight from CR#62 (allocation dominates quantity). The pattern is now validated at three levels: inference compute allocation, training signal allocation, and experience quality — all three show that *quality of information processing* dominates *quantity of resources*.

---

*Filed: 2026-03-16 | Session: s_1773694404685_571 | DD count: 356*
