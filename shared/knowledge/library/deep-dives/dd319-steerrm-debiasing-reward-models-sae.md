# DD#319: SteerRM — Debiasing Reward Models via Sparse Autoencoders

**Paper:** arXiv:2603.12795 (13 Mar 2026)
**Authors:** Mengyuan Sun, Zhuohao Yu, Weizheng Gu, Shikun Zhang, Wei Ye (Peking University)
**Venue:** cs.CL
**Relevance:** ★★★★★ CRITICAL — 9/10

## One-Line Summary
Training-free reward model debiasing using SAE-based feature identification and suppression, improving format-bias resistance by 7.3 points without retraining.

## Core Problem
Reward models (RMs) exhibit systematic format bias — preferring well-formatted (Markdown) responses over semantically superior plain-text ones. This distorts RLHF alignment by incentivizing presentation over correctness. Existing fixes require retraining or architectural changes.

## Key Mechanism: Three-Stage Pipeline

### Stage 1: Format-Controlled Pair Synthesis
- Generate content-matched (Markdown vs plain-text) response pairs using GPT-4.1 mini
- 500 pairs across chat, reasoning, math, code domains
- Strict validation: regex confirms Markdown presence/absence, embedding dedup, manual audit

### Stage 2: SAE Feature Identification
- Extract hidden representations from RM layers 0-9 (selected via reconstruction quality analysis)
- Encode into SAE latent space using pretrained LlamaScope SAEs
- Compute paired difference: d_{i,j} = z̄_j(x, y_md) - z̄_j(x, y_pl)
- Score features via **strength-stability criterion**: score_j = μ̄_j · (σ̄_j + ε)^{-1}
- Global top-K selection (K=10) across all layers

### Stage 3: Inference-Time Steering
- Zero out identified format features in SAE latent space
- Reconstruct hidden states from modified latents via SAE decoder
- Forward hooks on transformer blocks; non-special-token positions only
- **No parameter updates** — purely activation editing

## Key Findings

### 1. Format Features Are Shallow
- Top-100 format-related features concentrated in **layers 1-3**
- Surface-level formatting is encoded in early transformer layers
- Higher layers encode increasingly entangled format+content representations

### 2. SAE Decomposition Is Necessary
- **Direct activation suppression** (subtracting mean bias direction) causes catastrophic collapse:
  - Average accuracy drops to 47.6-59.5% (near-random)
  - Representation entanglement means content signals are destroyed alongside format signals
- SAE sparse decomposition disentangles format from content, enabling targeted intervention

### 3. Performance Results (RM-Bench)
- Hard split accuracy: **+7.3 points average** across 6 LLaMA-based RMs
- Normal split (format-fair): essentially unchanged (-1.0 point)
- Easy split: -5.1 points (expected — removes format shortcut that inflated scores)
- Cross-architecture: +5.7 on Gemma-based RM using Gemma Scope SAEs
- Beyond formatting: politeness bias also mitigable (+0.8% recovery)

### 4. Cross-Model Feature Transfer
- Features identified on Skywork transfer to 5 other LLaMA-family RMs
- Hard split gains: +8.6 to +28.4 across target models
- Format encoding is architecture-level, not model-specific

## Why This Matters for Multi-Agent Systems

1. **Alignment Infrastructure**: RMs are judges/evaluators in multi-agent pipelines. Format bias means agents rewarded for presentation rather than correctness — undermining quality signals.

2. **Training-Free Intervention**: No retraining means practical deployment in dynamic agent ecosystems where models change frequently.

3. **Interpretable Debiasing**: SAE features provide interpretable handles on what's being suppressed, crucial for auditing alignment in production.

4. **Cross-Model Transfer**: Format features transfer across models sharing architecture — could enable universal debiasing dictionaries for agent fleets.

## Connections to Portfolio
- **GER-Steer (DD#318)**: Both use activation steering but different objectives — evolutionary behavioral control vs. surgical bias removal
- **Bio-Inspired Dynamics (CR#153)**: Complements neuromodulation approach to inference-time control
- **Reward Model landscape**: Connects to distillation and RL verification themes across portfolio
- **Specification-to-Enforcement Gap (CR#34)**: Format bias exemplifies gap between intended reward (correctness) and enforced reward (formatting)

## Technical Depth
- **6 reward models** tested (Skywork, QRM, URM, Base-RM, Ins-RM, Tulu)
- Layer selection via 3 metrics: reconstruction MSE, reward delta, L0 sparsity
- Robustness to probing set size, data source, and K value validated in appendices
- Clean ablation showing SAE necessity vs. direct activation suppression

## Limitations
- Relies on pretrained SAEs being available for the base architecture
- Layer selection (0-9) is architecture-specific
- Easy-split degradation suggests some legitimate format quality signals may be removed
- Cross-architecture results limited to Gemma (one model)
