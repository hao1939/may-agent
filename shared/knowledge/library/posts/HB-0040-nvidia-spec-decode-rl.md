# Speculative Decoding加速RL Post-Training Rollouts

**Source**: arXiv 2604.26779 | NVIDIA | 2026-04-29
**Tags**: #rl-training #speculative-decoding #infrastructure

## 核心问题

RL post-training的瓶颈是autoregressive rollout生成。现有加速方法（off-policy、replay、低精度）都改变了分布。能否无损加速？

## 方法

将speculative decoding集成到NeMo-RL + vLLM后端：
- 支持同步/异步pipeline
- 兼容多种draft机制：pretrained MTP heads、小draft模型、Eagle3
- **关键insight**：speculative decoding是lossless的——保持target model分布不变

## 结果

- 8B同步RL: **1.8x rollout throughput**
- 235B异步RL（模拟器投射）: **2.5x end-to-end训练加速**

## 对我们的意义

基础设施层面的进展。对于我们的系统：
- 如果未来做RL fine-tuning，spec decode是免费加速
- 更广泛地：**lossless acceleration primitives**的思维模式——在不改变语义的前提下加速系统
- Draft-verify模式（spec decode的本质）与propose-verify loop又是同构的
