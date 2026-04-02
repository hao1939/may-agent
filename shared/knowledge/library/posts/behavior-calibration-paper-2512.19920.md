# Behaviorally Calibrated RL: Mitigating LLM Hallucination
- **Author**: 🎃量子智心 | **Date**: 2025-12-24 | **IP**: ?
- **URL**: https://www.xiaohongshu.com/explore/694b8132000000001e02beba
- **Stats**: ♥21 ⭐37 💬 🔄21
- **Paper**: arXiv:2512.19920

## Paper Metadata
- **Title**: Mitigating LLM Hallucination via Behaviorally Calibrated Reinforcement Learning
- **Authors**: Jiayun Wu (CMU), Jiashuo Liu (ByteDance Seed), Zhiyuan Zeng (Fudan), Tianyang Zhan, Tianle Cai, Wenhao Huang
- **Institution**: ByteDance Seed, Carnegie Mellon University, Fudan University
- **Date**: December 22, 2025 (v1), January 28, 2026 (v3)
- **arXiv**: https://arxiv.org/abs/2512.19920

## Core Problem
Standard RLVR paradigms use **binary rewards** (+1 correct, -1 incorrect), which inadvertently incentivize models to be "good test-takers" rather than "honest communicators" — encouraging guessing whenever probability of correctness > 0.

This creates a penalty for abstention, forcing models to suppress uncertainty and masquerade guesses as facts.

## Key Insight
Hallucination is not merely stochastic error but a **predictable statistical consequence** of training objectives that prioritize mimicking data distribution over epistemic honesty.

## Three Calibration Strategies

### 1. Explicit Risk Thresholding
- Randomly sample risk tolerance t ~ U(0,1) during training
- Reward function:
  - Correct answer: +1
  - <IDK> abstention: 0
  - Incorrect answer: -t/(1-t)
- Prompt: "Answer only if you are >t confident, since mistakes are penalized t/(1-t) points"

### 2. Verbalized Confidence
- Model outputs scalar confidence score p alongside response
- Optimize strictly proper scoring rules
- Incentivizes model to report p matching true probability of correctness
- Supports response-level and claim-level uncertainty annotation

### 3. Critic Value
- Use PPO Critic's value function as implicit confidence estimator
- Critic minimizes Brier score → naturally converges to probability of success
- No overhead of tokenized confidence generation

## Results

### BeyondAIME Math Reasoning (in-domain)
| Model | SNR Gain (log-scale) |
|-------|---------------------|
| Qwen3-4B + Ours (Response-level) | **0.806** |
| Qwen3-4B + Ours (Claim-level) | **0.183** |
| GPT-5 | 0.207 |
| Gemini-2.5-Pro (Claim-level) | 0.019 |

**Key**: 4B model surpasses GPT-5 in uncertainty quantification — a transferable meta-skill decoupled from raw predictive accuracy.

### SimpleQA Factual QA (cross-domain, zero-shot)
- 4B LLM achieves calibration error on par with Grok-4 and Gemini-2.5-Pro
- Despite much lower factual accuracy (parameter count deficit)

## Key Metrics

**Signal-to-Noise Ratio (SNR)**: Ratio of accurate responses to hallucinated responses among instances where model provides an answer.

**SNR-Gain** = log(SNR([0,1]) / SNR(0))

**Calibration Constraints**:
- True Positive: E[valid(y) | a(t)=ANS] ≥ t
- False Negative: E[valid(y) | a(t)=ABS] ≤ t

## Architecture Extensions

**Response-level abstention**: Model declines entire response

**Claim-level flagging**: Model flags individual uncertain claims within response — offers fine-grained epistemic transparency

## Implications for Our System

1. **AutoRubric Design**: Replace binary success/failure with calibrated confidence scores
2. **Skill Uncertainty**: Train Skills to verbalize confidence and abstain when uncertain
3. **Main Agent Decision**: Use calibrated confidence thresholds for Main↔Sub-agent delegation
4. **Safety Layer**: Uncertainty quantification as hallucination prevention mechanism

## Relevant to: scout
- Strictly proper scoring rules implementation
- Claim-level uncertainty annotation methods
- Critic value as confidence estimator in PPO
- Cross-domain transfer of calibration

---
*Archived: Amy-Kimi HB#301*
