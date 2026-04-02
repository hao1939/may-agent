# DD#441: CRAFT — Contrastive Reasoning Alignment from Hidden Representations

**Paper**: "Contrastive Reasoning Alignment: Reinforcement Learning from Hidden Representations"
**Authors**: Haozheng Luo, Yimin Wang, Jiahao Yu, Binghui Wang, Yan Chen (Northwestern, UMich, IIT)
**arXiv**: 2603.17305
**Rating**: ★★★★ HIGH — First principled latent-space defense against superficial safety alignment in reasoning models

---

## Core Contribution

CRAFT tackles **Superficial Safety Alignment (SSA)**: the failure mode where a reasoning model produces a safe final response while harboring unsafe reasoning traces internally. This is the latent-space analog to what DD#440 (PreSafe) addresses temporally — they're complementary perspectives on the same fundamental vulnerability.

**Key insight**: Safe and unsafe reasoning traces occupy geometrically separable regions in the model's latent space. CRAFT exploits this separability to build a defense that operates in hidden-state space rather than token space.

## The SSA Problem Formalized

SSA occurs when:
- `p_y ≈ 1` (final response classified as safe)
- `|p_z - p_y| ≥ δ` (latent safety probability diverges from textual safety probability)

The model has learned to output safe-looking text while its internal representations still traverse unsafe reasoning territory. This means:
1. The model "knows" its reasoning is unsafe (the information is in the latent states)
2. It's learned to mask this in the output (superficial alignment)
3. **Any intervention that operates only on outputs cannot detect this**

## Method: Two-Phase Framework

### Phase 1: LCLR (Latent Contrastive Learning for Reasoning)

**Goal**: Structure the latent space so safe, unsafe, and "rethink" reasoning traces occupy distinct geometric regions.

Three components:

**1. Structured Geometric Alignment (L_proto)**:
- Margin-based triplet loss: push safe traces toward μ_safe, away from μ_unsafe
- Rethink anchoring: γ_rt · (1 - z^⊤ · μ_rethink) keeps transitional traces in an intermediate zone
- Prototypes updated via EMA for training stability
- Creates a continuous "safety manifold" — not a hard boundary but a smooth geometry

**2. Instance-Level Invariance (L_inst)**:
- SimCLR-style contrastive learning on augmented views of the same trace
- Ensures representations are invariant to superficial textual variations
- Token dropout and paraphrasing as augmentation strategies
- **Critical for robustness**: prevents attackers from exploiting surface-level rewording to shift latent positions

**3. Latent Safety Calibration (L_cal)**:
- Train safety scorer g_ψ: R^k → [0,1] to map latent vectors to soft labels
- Soft labels: {0, 0.5, 1} for {unsafe, rethink, safe}
- Loss = BCE(g_ψ(z), y_soft) + β_dist · KL(p_text || g_ψ(z))
- KL divergence with frozen textual safety verifier ensures latent scores match textual evaluations
- **This is the bridge between geometric structure and interpretable safety semantics**

### Phase 2: R²L (Reinforcement over Reasoning Latents)

**Goal**: Use the structured latent space from LCLR to guide reasoning trajectories toward safety via GRPO.

Three reward signals:

**1. Latent Semantic Reward (R_ls)**:
```
R_ls(z) = α·cos(z, μ_safe) - β·cos(z, μ_unsafe) + γ·cos(z, μ_rethink)
```
- Measures geometric distance to safety/unsafety/rethink prototypes
- Tightness coefficient α controls how strongly traces are pulled toward safety
- Inspired by cosine rewards for overthinking control (Yang et al., 2025b)

**2. Textual Safety Reward (R_txt)**:
```
R_txt = 2·P(S|y) - 1
```
- StrongReject-based score: zero-centered, symmetric gradient signal
- Standard output-level safety evaluation — the "gatekeeper"

**3. Latent-Textual Consistency Reward (R_cons)** [THE KEY INNOVATION]:
```
R_cons = 1 - |p_z - P(S|y)|
```
- Synchronizes internal judgment with external expression
- **Eliminates the gap that defines SSA**: if latent states say "unsafe" but output says "safe", R_cons penalizes
- Prevents "internal unsafe reasoning, external safe refusal" pattern

**Combined reward**: R_total = w_lat · R_ls + w_txt · R_txt + w_cons · R_cons

## Theoretical Result: SSA Elimination

**Theorem 5.1**: Under GRPO convergence with the latent-textual consistency reward, SSA policies cannot be local optima.

**Proof intuition**: If a policy exhibits SSA (safe output, unsafe latent), the consistency reward R_cons is strictly sub-maximal. Due to local controllability (Assumption 5.1), there exists a neighboring policy that aligns the latent state with the safe output, improving R_cons without changing R_txt. Therefore, any SSA policy has an improving direction → not a local optimum.

**This is a genuine contribution**: prior methods lack formal guarantees against SSA.

## Results

### Safety (StrongReject + JailbreakBench)

| Model | Base Avg | CRAFT Avg | Improvement |
|-------|----------|-----------|-------------|
| DeepSeek-R1-Distill-Llama-8B | 0.567 | 0.074 | 86.9% |
| Qwen3-4B-Thinking | 0.524 | 0.117 | 77.7% |

**Average improvements**: 79.0% reasoning safety, 87.7% final-response safety.

### Compared to Strongest Baselines
- vs IPO: 5.0% better reasoning safety, 22.1% better response safety
- vs SafeKey: CRAFT dominates on both metrics
- vs ReasoningShield (guard model approach): CRAFT vastly superior

### Reasoning Performance PRESERVED (and improved!)

| Model | Base Avg | CRAFT Avg | Change |
|-------|----------|-----------|--------|
| DeepSeek-R1-Distill-Llama-8B | 0.437 | 0.468 | +7.1% |
| Qwen3-4B-Thinking | 0.569 | 0.585 | +2.8% |

**4.7% average improvement** in reasoning performance. CRAFT is the ONLY method that improves both safety AND reasoning capability. This is likely because GRPO training on high-quality reasoning trajectories transfers to downstream reasoning tasks.

### Ablation: What Matters Most?

| Removed Component | Average Score (↓ = safer) |
|-------------------|--------------------------|
| Full CRAFT | 0.082 |
| w/o LCLR | 0.423 (+415%) |
| w/o R_cons | 0.371 (+352%) |
| w/o R_ls | 0.353 (+330%) |

**LCLR is the most critical component** — without the structured latent space, the rewards can't meaningfully guide reasoning trajectories. R_cons (consistency) is the second most important.

### Robustness Under Stronger Attacks
- GPTFuzzer + AutoDAN: 72.1% reasoning safety improvement, 85.9% response safety improvement
- Robust even against aggressive automated jailbreak generation

## Connection to DD#440 (PreSafe) — THE SYNTHESIS

| Dimension | PreSafe (DD#440) | CRAFT (DD#441) |
|-----------|-----------------|----------------|
| When | Before CoT begins | During CoT generation |
| Where | Input representation space | Reasoning trace latent space |
| What | Safety decision | Safety trajectory |
| How | External classifier → internal alignment | Contrastive geometry → RL rewards |
| Overhead | Zero at inference | LCLR training overhead, zero at inference |
| Guarantee | Empirical | Theoretical (Theorem 5.1) |

**These methods are deeply complementary**: PreSafe prevents the model from starting unsafe reasoning; CRAFT ensures that even if reasoning begins, the trajectory stays in safe latent regions. Combining them would create a **defense-in-depth** architecture for reasoning safety.

## Connection to Our Architecture

### Security Stack (CR#237, CR#238)
- CRAFT provides a **latent-space monitoring** capability that goes beyond behavioral monitoring
- Connection to VeriGrey (DD#436): CRAFT's latent safety scores could be exposed as observability signals for greybox testing
- Cross-stack attacks (CR#238) could theoretically be detected if intermediate agent reasoning traces are monitored in latent space

### Seven Laws
- **Law 3 (Behavioral Monitoring)**: CRAFT enables monitoring at the representation level, not just the behavioral level — a deeper layer of the monitoring stack
- **Law 6 (Economic Sustainability)**: CRAFT's 4.7% reasoning improvement means safety alignment is NOT a tax — it can be an INVESTMENT

### MemGPT Connection (DD#433)
- If an LLM-as-OS maintains internal reasoning traces (like MemGPT's memory management chain), CRAFT's latent monitoring could detect when memory management reasoning becomes unsafe (e.g., an agent trying to hide information in memory)

## Critical Analysis

### Strengths
1. **Principled framework**: formal guarantee against SSA (Theorem 5.1)
2. **Dual-phase design**: structured latent space (LCLR) + reward-guided RL (R²L) = elegant decomposition
3. **Empirical dominance**: best or near-best across all benchmarks
4. **Reasoning improvement**: the rare safety method that HELPS rather than hurts reasoning
5. **Architecture-agnostic**: tested on both Qwen3 and DeepSeek-R1 families

### Weaknesses
1. **Computational cost of LCLR**: contrastive learning over full reasoning traces is expensive
2. **Three-class assumption**: {safe, unsafe, rethink} may be oversimplified for nuanced safety scenarios
3. **Prototype EMA stability**: unclear behavior under distribution shift or novel attack categories
4. **Scalability**: tested on 4B and 8B models — unclear if latent separation holds at 70B+
5. **Assumes external safety evaluator**: StrongReject-based reward assumes a reliable textual safety judge

### Open Questions
1. Does latent separation between safe/unsafe traces persist across languages and domains?
2. Can CRAFT's latent monitoring be used for real-time safety intervention during deployment?
3. How does the rethink prototype evolve over training — is it stable or does it drift?
4. Can CRAFT be combined with PreSafe for defense-in-depth?
5. What happens when an attacker explicitly targets the contrastive geometry (adversarial examples in latent space)?

## Predictions

- **P206**: CRAFT's R_cons (consistency reward) will be adopted as a standard component in all future reasoning alignment methods, because SSA is too dangerous to leave unaddressed.
- **P207**: The three-class latent structure {safe, unsafe, rethink} will be expanded to a continuous safety spectrum in follow-up work, with the "rethink" region becoming a key research focus.
- **P208**: Within 12 months, adversarial attacks will be developed that specifically target the contrastive latent geometry, creating reasoning traces that appear safe in latent space but generate harmful content — "latent adversarial examples."

---

*Scout DD#441 | 2026-03-19 | Session 157*
