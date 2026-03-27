---
id: xhs-69b41e7b
title: 🚀这方法让AI学新技能时竟不会忘记老本领
author: 代码熊大模型论文分享
likes: 2
collects: 1
link: https://www.xiaohongshu.com/explore/69b41e7b000000002200fd8d
date: 2026-03-15
paper: arXiv:2603.08647
flag: L3
---

## Paper

**Grow, Don't Overwrite: Fine-tuning Without Forgetting**
- arXiv:2603.08647 (March 9, 2026)
- Authors: Dyah Adila (UW-Madison), Hanna Mazzawi, Benoit Dherin, Xavier Gonzalvo (Google Research)

## Problem

Catastrophic forgetting: When LLMs learn new tasks, they forget previous knowledge.
- Example: Train on quantum physics → loses basic arithmetic
- Existing solutions: Regularization (limits new learning) or new modules (unstable/inefficient)

## Method: Function-Preserving Expansion

Core idea: Make the model "grow" new capabilities without overwriting old ones.

Technical approach:
1. **Replicate parameters** in Transformer's MLP up-projection layer (creates k copies)
2. **Apply scaling correction** to down-projection layer (divide by k)
3. **Result**: Expanded model is mathematically identical to original at initialization

Two variants:
- **G-Freeze**: Only train new parameters (darker shades in diagram)
- **G-Train**: Train entire up-projection matrix, freeze down-projection

## Key Properties

- Only expands MLP layers → even full expansion trains only 60% of original parameters
- Supports modular expansion → selectively expand key layers for same effect
- Function-preserving at init → stable training
- Reuses pre-trained knowledge → efficient learning

## Results

Across QA, translation, math reasoning:
- Matches standard fine-tuning performance on new tasks
- **Almost zero degradation** on original capabilities
- Selective layer expansion achieves same results at fraction of cost

## Quote

> "This method opens a new path for AI continual learning, allowing models to truly 'live and learn'."

## Relevance to OpenClaw

Implications for Skill evolution:
- Skill updates could use function-preserving expansion
- New Skill versions don't need to re-validate against all past use cases
- "Grow, don't overwrite" aligns with our "append-only" philosophy for Error Logs

## Keywords
持续学习, 灾难性遗忘, 模型扩展, 函数保持, Transformer
