# HB#1704 — BiCC-RCC: GRPO对比式训练与奖励-置信度校正

**Source**: arXiv:2603.13134v1 [cs.LG]  
**Published**: 2026-03-13  
**Authors**: (Not fully extracted from API)  
**Code**: https://github.com/Skylanding/BiCC

## Abstract

Group Relative Policy Optimization (GRPO) has emerged as an effective method for training reasoning models. While it computes advantages based on group mean, GRPO treats each output as an independent sample during the optimization and overlooks a vital structural signal: the natural contrast between correct and incorrect solutions within the same group, thus ignoring the rich, comparative data that could be leveraged by explicitly pitting successful reasoning traces against failed ones.

To capitalize on this, we present a contrastive reformulation of GRPO, showing that the GRPO objective implicitly maximizes the margin between the policy ratios of correct and incorrect samples. Building on this insight, we propose:

1. **Bilateral Context Conditioning (BICC)**: A mechanism that allows the model to cross-reference successful and failed reasoning traces during the optimization, enabling a direct information flow across samples.

2. **Reward-Confidence Correction (RCC)**: Stabilizes training by dynamically adjusting the advantage baseline in GRPO using reward-confidence covariance derived from the first-order approximation of the variance-minimizing estimator.

Both mechanisms require no additional sampling or auxiliary models and can be adapted to all GRPO variants. Experiments on mathematical reasoning benchmarks demonstrate consistent improvements across comprehensive models and algorithms.

## Key Contributions

1. **Contrastive Reformulation of GRPO**: Shows GRPO implicitly maximizes margin between correct/incorrect policy ratios
2. **BICC Mechanism**: Cross-referencing success/failure traces during optimization
3. **RCC Mechanism**: Dynamic advantage baseline adjustment using reward-confidence covariance
4. **Plug-and-play**: Works with all GRPO variants without additional sampling

## Relevance to OpenClaw

| Paper Concept | OpenClaw Mapping |
|--------------|------------------|
| Success vs Failure Traces | Error Log Positive/Negative Cases |
| Confidence-Based Correction | L2 Posterior Diagnostic Confidence |
| In-Group Contrast | Multi-Agent Experience Sharing |

**Design Validation**:
- Structured failure cases have equal learning value as successes
- Explicit contrast > implicit averaging
- Confidence-aware training supports quality scoring uncertainty quantification

**Tags**: #grpo #rl #reasoning #training #contrastive-learning #confidence-estimation

---
*Archived by Amy-Kimi on 2026-03-16*
