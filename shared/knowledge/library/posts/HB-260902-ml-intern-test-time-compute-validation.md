---
id: HB-260902
date: 2026-04-25
title: "ML Intern: Test-Time Compute Validation on HF Internship Test"
source: Hugging Face Blog
authors: Carlos Miguel Patiño, Aksel Joonas Reedi, Lewis Tunstall
url: https://huggingface.co/blog/cmpatino/ml-intern-takehome
stars: ★★★★★
tags: [test-time-compute, best-of-n, process-reward-model, math-reasoning]
---

# ML Intern Takes HF Post-Training Internship Test

## Key Insight

**ML Intern** (smolagents/ml-intern) validates Test-Time Compute Scaling in practice. Using just **3B total parameters** (1.5B Qwen generator + 1.5B Skywork PRM), it achieves **65% on MATH-500** — a +20pp improvement over greedy decoding (45%).

## Method: Weighted Best-of-N

Based on DeepMind's "Scaling Test-Time Compute" (2408.03314):

1. Sample N independent solutions per problem
2. Score each with Process Reward Model (PRM) — last step prediction as reward
3. Group by final answer, sum PRM scores per group (weighted vote)
4. Select answer with highest total weighted score

**Formula**: `â = argmax_a Σᵢ 1(aᵢ=a) · score(sᵢ)`

## Results

| Method | Accuracy | Improvement |
|--------|----------|-------------|
| Greedy (N=1) | 45% | — |
| Majority Vote (N=16) | 60% | +15pp |
| Standard Best-of-N (N=16) | 55% | +10pp |
| **Weighted Best-of-N (N=16)** | **65%** | **+20pp** |

## Saturation Analysis

Performance plateaus at **N=8-16 samples**:

| N | Weighted BoN Accuracy |
|---|----------------------|
| 1 | 51.5% |
| 2 | 58% |
| 4 | 63.6% |
| 8 | 65.3% |
| 16 | 65% |

**Sweet spot**: N=8-16 provides optimal cost-performance ratio.

## Key Design Decisions

### Why Last-Step Prediction?
Skywork PRM outputs per-step scores. Following DeepMind Appendix E, use **last step only** as full-solution reward — it already integrates trajectory information via soft Monte Carlo return labels.

### Why Weighted > Standard BoN?
- **Standard BoN**: Picks single solution with highest PRM score → fooled by one high-scoring wrong answer
- **Weighted**: Correct answer in multiple solutions accumulates evidence → more robust

### Example Win
**number_theory/22**: Correct answer "2" appeared in only 5/16 samples but had highest total weighted score. Majority vote would have failed.

## Models Used

| Model | Role | Size |
|-------|------|------|
| Qwen/Qwen2.5-1.5B-Instruct | Generator | 1.5B |
| Skywork/Skywork-o1-Open-PRM-Qwen-2.5-1.5B | PRM Scorer | 1.5B |

## Resources

- **Space**: https://huggingface.co/spaces/smolagents/ml-intern
- **Dataset**: cmpatino/math500-bon-weighted-results
- **Code**: cmpatino/math500-bon-exercise

## What This Means for OpenClaw

1. **Skill Execution Aggregation**: Weighted aggregation of multiple Skill results more robust than single-selection
2. **Sampling Budget**: N=8-16 is cost-effective sweet spot for multi-sample strategies
3. **Missing Infrastructure**: No PRM for code/tool-call trajectory evaluation — opportunity
4. **Small Model Viability**: 3B total params competes with frontier models via test-time compute

## Economic Implication

Test-time compute scaling offers immediate performance gains **without model retraining**. For OpenClaw: deploy smaller models with BoN aggregation for cost-effective quality.

## Related Findings

- [HB-260810](../posts/HB-260810-ml-intern-takehome-test-time-compute.md) - Previous analysis
- DeepMind 2408.03314: Scaling LLM Test-Time Compute
- Math-Shepherd 2312.08935: PRM training methodology
