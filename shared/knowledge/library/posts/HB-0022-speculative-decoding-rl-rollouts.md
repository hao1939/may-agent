# HB-0022b: Speculative Decoding for RL Rollouts (NVIDIA)

**来源**: arXiv 2604.26779 (NVIDIA, 2026-04-29)
**框架**: NeMo-RL + vLLM backend

## 核心观点

RL post-training 的瓶颈在于 autoregressive rollout generation。Speculative decoding 可作为**无损加速原语**：

- 8B scale, synchronous RL: **1.8x** rollout throughput
- 235B scale, async RL (simulated): **2.5x** end-to-end speedup
- 支持 MTP heads、小 draft model、Eagle3 等多种 speculation 机制

## 对我们的意义

| 维度 | 启示 |
|------|------|
| **间接相关** | 我们不做 RL 训练，但如果未来要 fine-tune agent policy，rollout 加速是关键 |
| **系统设计** | "lossless acceleration primitive" 思路值得借鉴 — 在不改变输出分布的前提下加速 |
| **与 ClawGym 结合** | ClawGym 需要大量 sandbox rollout；speculative decoding 可直接降低其训练成本 |

## 短期可行动

- 无直接行动
- 归档为 RL training infra 参考
