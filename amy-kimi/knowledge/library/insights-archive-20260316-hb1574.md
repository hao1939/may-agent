---
id: HB#1574
title: "Balanced Thinking: Confidence-Based Dynamic Control for Efficient Reasoning"
source: arXiv:2603.12372 [cs.AI] (ICLR 2026, HIT/Tsinghua/Huawei Noah's Ark Lab)
date: 2026-03-16
tags: [reasoning-efficiency, confidence-calibration, dynamic-control, overthinking, underthinking]
---

## Core Discovery
**ReBalance框架**: 无训练、即插即用的推理效率优化方法，通过confidence动态检测并纠正overthinking/underthinking。

### Key Mechanism: Confidence as Reasoning State Indicator

| Reasoning Mode | Confidence Pattern | Steering Action |
|---------------|-------------------|-----------------|
| **Overthinking** | High variance (频繁切换推理路径) | Prune redundancy (δ=-1) |
| **Underthinking** | Consistent overconfidence (过早承诺) | Promote exploration (δ=+1) |
| **Balanced** | Moderate confidence + low variance | Maintain trajectory |

### Dynamic Control Function

**Steering Vector**: v = (μ^O - μ^U) / ||μ^O - μ^U||_2
- μ^O: Overthinking prototype (高方差低置信样本聚合)
- μ^U: Underthinking prototype (低方差高置信样本聚合)

**实时控制公式**:
```
α_s = sign(c_s - τ_c^H) · B(c_s, v_s) · tanh(|c_s - τ_c^H|)
```
- Direction δ_s: 根据置信度阈值决定促进/抑制探索
- Strength λ_s: variance-aware amplitude + soft saturation

### Experimental Results (DeepSeek-R1-Distill-Qwen-1.5B)

| Dataset | Pass@1 Δ | Token Δ |
|---------|----------|---------|
| MATH-500 | +3.4% | -23.1% |
| AIME24 | +10.0% | -14.3% |
| GSM8K | +2.3% | -24.9% |

**关键发现**: 同时提升准确率并减少输出长度（vs 其他方法牺牲准确率换效率）。

### OpenClaw架构验证

| ReBalance组件 | OpenClaw映射 | 启示 |
|--------------|-------------|------|
| Confidence-based step validation | SKILL.md L1/L2验证成功率 | 用成功率作为confidence proxy |
| Overthinking detection | 循环检测/重复调用检测 | 需实现runtime overthinking guard |
| Underthinking detection | 过早返回/浅层推理检测 | Error Log记录underthinking模式 |
| Steering vector | AGENTS.md决策约束调整 | 动态约束强化/放松 |

### Critical Design Implications

1. **SKILL.md验证即confidence估计**: 步骤级成功率可作为overthinking/underthinking的代理指标
2. **Error Log双模式记录**: 区分"冗余探索"(overthinking)与"过早收敛"(underthinking)的失败模式
3. **动态约束调整**: AGENTS.md约束应根据历史confidence动态调整严格程度

### L3 Flags
- #1574-A: 实现SKILL步骤级confidence追踪 (基于验证结果)
- #1574-B: 设计overthinking检测 (重复模式/循环检测)
- #1574-C: 设计underthinking检测 (过早终止/浅层推理)
- #1574-D: 评估动态AGENTS.md约束调整机制

---
*Archived: 2026-03-16*
