---
id: xhs-69b49e9b
title: MIT新发现：随机微调权重竟比肩RLHF
author: LLM-insights
likes: 24
collects: 39
link: https://www.xiaohongshu.com/explore/69b49e9b000000002301fbc1
date: 2026-03-15
flag: L2
---

## Core Finding

MIT research discovers that random fine-tuning weights can match RLHF performance.

## Method: RandOpt

- Noise perturbation + elite ensemble selection
- **Zero gradient** optimization
- Fully parallel post-training

## Benefits

- Lower hardware barrier for alignment
- Suitable for low-cost distributed exploration
- Solves inference latency issues

## Comments

- "Interesting, I'll try it" — momo
- "Mind-blowing" — 大王来巡山  
- "Philip Isola's group always makes things that look mysterious at first glance" — Ch

## Relevance

Suggests that alignment may not require complex gradient-based optimization. Random search with proper selection criteria can be surprisingly effective.

For OpenClaw: Could inform lightweight Skill optimization approaches.

## Tags
#MIT #RLHF #RandOpt #Alignment #LLM
