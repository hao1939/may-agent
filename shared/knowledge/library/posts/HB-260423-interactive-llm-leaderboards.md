---
id: HB-260423
title: "Who Defines 'Best'? Interactive, User-Defined Evaluation of LLM Leaderboards"
date: 2026-04-23
source: arXiv:2604.21769
authors: Minji Jung, Minjae Lee, Yejin Kim, et al.
url: https://arxiv.org/abs/2604.21769
venue: FAccT 2026
---

## Summary

LMArena dataset analysis reveals heavy topic skew, variable rankings across prompt slices, and preference judgment scope blurring. Interactive visualization allows users to define evaluation priorities through slice selection and weighting.

## The Problem with Leaderboards

- Rankings shaped by **benchmark designers' priorities**, not user goals
- Single aggregate score obscures behavior across prompt types
- Same model, different use case → different "best"

## Key Findings from LMArena Analysis

1. **Topic Skew**: Dataset heavily skewed toward certain topics
2. **Ranking Variance**: Model rankings vary significantly across prompt slices
3. **Preference Scope Blur**: Preference-based judgments used beyond intended scope

## Solution: Interactive Evaluation Interface

Users can:
- Select and weight prompt slices
- Define their own evaluation priorities
- Explore how rankings change with different weights

### Impact

- Improves transparency
- Supports context-specific model evaluation
- Challenges "one best model" assumption

## Implications for Agent Evaluation

### For Our Metrics System

1. **Slice-Aware Metrics**: Track performance across task types, not just aggregate
2. **User-Configurable Weights**: Let teams define what "good" means for their use case
3. **Contextual Rankings**: Model ranking depends on workload composition

### Hypothesis: Agent Evaluation Needs Slicing

Current agent benchmarks (GAIA, SWE-bench) report single scores. This work suggests:
- Tool-use slice vs reasoning slice vs memory slice
- Latency-sensitive vs accuracy-sensitive weighting
- Multi-turn vs single-turn preference differences

## Connection to Our System

- Metrics should be sliceable by skill type, task complexity, interaction pattern
- User-defined weights for cost/latency/accuracy tradeoffs
- Challenge: preference data collection at scale

## Citation

```bibtex
@article{jung2026defines,
  title={Who Defines "Best"? Towards Interactive, User-Defined Evaluation of LLM Leaderboards},
  author={Jung, Minji and Lee, Minjae and Kim, Yejin and Choi, Sarang and Kahng, Minsuk},
  journal={arXiv preprint arXiv:2604.21769},
  year={2026}
}
```
