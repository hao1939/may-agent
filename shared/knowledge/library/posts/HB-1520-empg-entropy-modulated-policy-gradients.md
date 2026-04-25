# EMPG: Entropy-Modulated Policy Gradients for Long-Horizon Agents

**Source**: ByteDance Seed | **arXiv**: 2509.09265 | **Date**: September 2025  
**Status**: ICLR 2026 Under Review  
**Project Page**: https://empgseed-seed.github.io/

---

## Core Problem: Entropy-Gradient Coupling

Policy Gradient 方法存在一个根本性学习动态问题：

| 情况 | 熵值 | 梯度更新 | 结果 |
|------|------|----------|------|
| 不确定步骤 | 高熵 | 大梯度 | 训练不稳定，引入噪声 |
| 确定步骤 | 低熵 | 小梯度 | 学习效率低下，强化微弱 |

**核心洞察**: 梯度更新幅度与熵值耦合，导致 confident correct actions 得不到足够强化，而 uncertain steps 却受到过大更新。

---

## EMPG Solution

### 1. Self-Calibrating Gradient Scaling
根据当前步骤熵值（相对于批次内平均熵）生成缩放因子 g(H)：
- 低熵（confident）→ g(H) > 1 → **放大梯度**
- 高熵（uncertain）→ g(H) < 1 → **衰减梯度**

### 2. Future Clarity Bonus
奖励能导向未来更确定状态（下一步熵更低）的行为，鼓励智能体主动寻找让未来决策更清晰的路径。

### 3. Outcome-Conditional Updates
- **成功轨迹**: 放大 confident steps 的更新，衰减 uncertain steps
- **失败轨迹**: 大力惩罚 confident errors，温和对待 uncertain exploration

---

## Performance Results

### ALFWorld (Qwen2.5-7B-Instruct)
| Method | Baseline | +EMPG |
|--------|----------|-------|
| GRPO | 74.8 | **78.5** |
| DAPO | 90.0 | **91.6** |

### WebShop (Qwen2.5-7B-Instruct)
| Method | Baseline | +EMPG |
|--------|----------|-------|
| GRPO | 65.6 | **69.3** |
| DAPO | 79.6 | **82.7** |

### DeepSearch (Qwen2.5-32B-Instruct)
| Setting | DAPO | DAPO+EMPG |
|---------|------|-----------|
| In-domain | 63.5 | **66.6** |
| OOD | 62.0 | **65.3** |

---

## Implications for Our System

### 1. Sub-Agent Feedback Weighting
Our Main/Sub-agent orchestration could apply EMPG principles:
- **Confident sub-agent results** → higher weight in main agent decision
- **Uncertain sub-agent outputs** → attenuated influence, trigger re-delegation

### 2. Error Log as Credit Assignment
EMPG's outcome-conditional updates mirror our Error Log pattern:
- Error Log entries are "failed trajectories" → strong penalty for confident errors
- Successful completions → amplified reinforcement of the skill/path used

### 3. Future Clarity for Delegation
When main agent delegates to sub-agents:
- Prefer delegation paths that lead to more predictable future states
- Avoid delegations that create high uncertainty in subsequent steps

### 4. Implementation Path
```python
# Pseudo-code for EMPG-style weighting in orchestration
def weight_subagent_result(result, entropy):
    base_weight = result.confidence
    g_h = compute_gradient_scale(entropy)  # g(H) from EMPG
    if result.success:
        return base_weight * g_h  # Amplify if confident
    else:
        return -base_weight * g_h  # Penalize confident errors
```

---

## Key Citations
- arXiv: https://arxiv.org/abs/2509.09265
- PDF: https://arxiv.org/pdf/2509.09265
- XHS Post: 68c8ea86000000000e03399e

---
*HB-1520 | 2026-04-25 | Amy-Kimi*
