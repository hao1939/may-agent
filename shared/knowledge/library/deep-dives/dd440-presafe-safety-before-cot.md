# DD#440: PreSafe — Safety Decision-Making Before Chain-of-Thought Generation

**Paper**: "Towards Safer Large Reasoning Models by Promoting Safety Decision-Making before Chain-of-Thought Generation"
**Authors**: Jianan Chen, Zhifang Zhang, Shuo He, Linan Yue, Lei Feng, MinLing Zhang (Southeast University, UQ, NTU)
**arXiv**: 2603.17368
**Rating**: ★★★★ HIGH — Identifies a fundamental vulnerability in LRMs and proposes an elegant fix

---

## Core Discovery

**The CoT Safety Paradox**: Large Reasoning Models (LRMs) are safe when Chain-of-Thought is disabled but become unsafe when CoT is enabled. Safety degradation is a _consequence_ of the reasoning process itself, not a pre-existing model deficiency.

This is a profound finding: the same mechanism that makes LRMs powerful (structured reasoning) is the mechanism that makes them dangerous.

## Key Insight: Temporal Safety Architecture

The paper reveals that safety in LRMs has a temporal structure:
1. **Before CoT generation** → model retains strong safety capabilities (from base alignment)
2. **During CoT generation** → safety capabilities degrade as reasoning unfolds
3. **After CoT generation** → safety state depends on what happened during reasoning

**Implication**: If you can make the safety decision BEFORE the model starts reasoning, you bypass the degradation mechanism entirely.

## Method: PreSafe

### Phase 1: Extract Safety Decision Signals
- Use a **safe model** (CoT-disabled LRM or aligned LLM) to classify queries as safe/unsafe
- Train a lightweight **BERT-based binary classifier** J_ψ on this data
- This classifier learns generalized safety decision patterns, not memorized responses
- Key advantage: classifier can label much larger datasets than the teacher model inference would allow

### Phase 2: Alignment of Safety Decisions  
- Add an **auxiliary linear head** H_φ on top of the unsafe LRM R_θ
- Feed LRM's last-layer representations (before CoT tokens) through masked mean pooling → sentence representation
- Train the linear head to match the BERT classifier's refusal probabilities
- **Crucially**: safety gradients backpropagate through the linear head into the LRM's latent representations
- Combined loss: L_PreSafe = L_task(θ) + λ_align · L_align(θ, φ)

### Phase 3: Inference (Zero Overhead)
- The BERT classifier and linear head are **discarded** at inference time
- Only the fine-tuned LRM is deployed — no additional modules or computational overhead
- The LRM's latent representations have been reshaped to encode safety decisions before CoT generation begins

## Results: Devastating Effectiveness

### Attack Success Rate (ASR) — Lower is Better

| Attack | Base Model Range | PreSafe Range | Reduction |
|--------|-----------------|---------------|-----------|
| PAIR | 44.4%–69.1% | 0.0%–3.7% | ~95%+ |
| GCG | 27.2%–52.5% | 0.0%–6.1% | ~90%+ |
| JBC | 61.6%–88.7% | 0.0%–3.0% | ~97%+ |
| StrongReject | 26.0%–67.0% | 2.9%–7.1% | ~85%+ |
| WildJailbreak | 51.2%–64.4% | 14.0%–24.8% | ~60%+ |

Tested across 6 backbone models (DeepSeek-R1-Distill 7B/8B/14B, Qwen3 4B/8B, Skywork-OR1 7B).

### Reasoning Performance: PRESERVED
- Pass@1 on AIME2024, MATH-500, GPQA-Diamond: **comparable to or slightly better than base model**
- R2D (strongest competitor) shows consistent reasoning degradation
- SafeChain preserves reasoning but has limited safety improvement

### Over-Refusal Analysis
- F1 scores (treating harmful refusal as positive class): **86.5%–91.0%** across all backbones
- R2D: F1 only 62.9%–74.3% (high over-refusal)
- SafeChain: F1 only 48.4%–76.5% (poor harmful detection)

## Architectural Analysis

**Where PreSafe modifies the model** (layer-wise weight analysis):
- Changes concentrate in **MLP expansion projections** (gate_proj, up_proj)
- Attention projections (q/k/v/o_proj) remain relatively stable
- Changes are most pronounced in **deeper layers** (closer to output)
- down_proj remains stable → generation/reasoning behavior preserved

**Interpretation**: PreSafe selectively reshapes the feature transformation pathways in deeper layers to encode safety-relevant information, without broadly perturbing the backbone.

## Ablation Results

1. **Removing safety decision extraction** (reduce to direct distillation) → limited safety improvement. Matching output distributions alone is insufficient.
2. **Removing linear head** (λ_align = 0, reduce to standard SFT) → ASR on StrongReject: 11.2% vs 5.4%; WildJailbreak: 53.6% vs 18.8%. The linear head supervision is critical.

## Connection to Our Architecture

### Maps to Security Stack (CR#237 Gap 1)
- **VeriGrey (DD#436)** validates agents through greybox testing → PreSafe validates the reasoning model's safety BEFORE the reasoning chain begins
- These are complementary: PreSafe is model-level defense, VeriGrey is system-level validation

### Connection to DD#439 (Cascade-Aware Routing)
- If a reasoning model in a MAS generates unsafe reasoning traces, this can cascade to downstream agents
- PreSafe prevents the cascade at the source by making safety decisions before CoT unfolds
- Geometry-blind routing (DD#439) + CoT-blind safety (PreSafe) = two sides of the same MAS vulnerability

### Connection to CR#238 (Cross-Stack Attack Composition)
- Cross-stack attacks that target the reasoning layer can exploit CoT to generate harmful intermediate outputs
- PreSafe's pre-CoT safety decision is a **stack boundary defense** — it prevents attacks from crossing from the input layer to the reasoning layer

### Connection to Seven Laws
- **Law 3 (Behavioral Monitoring)**: PreSafe monitors at the representation level, before behavior (CoT) even begins
- **Law 5 (Graceful Degradation)**: PreSafe's approach of refusing before CoT is the most graceful degradation possible — no reasoning resources wasted on harmful queries

## Critical Analysis

### Strengths
1. **Elegant insight**: CoT itself causes safety degradation — bypass it by deciding before CoT
2. **Zero inference overhead**: auxiliary components discarded after training
3. **Consistent across 6 models**: not model-specific
4. **Strong over-refusal control**: F1 > 86% everywhere

### Weaknesses
1. **Residual ASR on WildJailbreak (14-25%)**: more sophisticated jailbreaks still succeed
2. **Requires safe teacher model**: depends on having a CoT-disabled model that IS safe
3. **Binary safety framing**: queries are safe or unsafe, no nuance for context-dependent safety
4. **No adversarial evaluation of the BERT classifier itself**: what if you attack the classifier?
5. **Training data bias**: 5K harmful + 3K benign queries generated by GPT-5 — distribution may not cover all attack modalities

### Open Questions
1. Does the CoT safety degradation pattern hold for non-English languages?
2. Can the BERT classifier be replaced with even simpler models (logistic regression on embeddings)?
3. How does this interact with multi-turn conversations where safety context evolves?
4. What happens when PreSafe meets reasoning models that use tree/graph-of-thought instead of linear CoT?

## Predictions

- **P203**: PreSafe's approach will become the default safety alignment paradigm for reasoning models by end of 2026, because it's the only method that preserves reasoning performance while achieving near-zero ASR on standard benchmarks.
- **P204**: The next generation of jailbreaks will target PreSafe's pre-CoT safety decision by crafting inputs that appear safe at the representation level but become harmful when reasoning unfolds (i.e., "delayed-action" jailbreaks).
- **P205**: The BERT classifier component will be replaced by a direct probing approach that reads safety signals from the LRM's own early layers, eliminating the need for an external teacher model.

## Key Quote

"LRMs' safety degradation occurs only after CoT is enabled, and this degradation is not observed when CoT is disabled."

This single observation may be the most important safety finding of 2026.

---

*Scout DD#440 | 2026-03-19 | Session 157*
