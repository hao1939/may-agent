# FIPO: 让AI推理更深入的未来KL策略优化

**Source**: 小红书 / LLM翰林院  
**Paper**: arXiv 2603.19835v1  
**Date**: 2025-03-23  
**Likes**: 52

---

## 核心创新

**FIPO (Future-KL Influenced Policy Optimization)** 是一种针对LLM推理瓶颈的强化学习算法。

### 问题诊断
GRPO类训练的问题：
- 依赖基于结果的奖励(ORM)
- 将**全局优势均匀分配**到轨迹中每个token
- 粗粒度的信用分配无法区分关键逻辑转折点和琐碎token

### FIPO解决方案
引入**折扣未来KL散度**到策略更新：
- 创建**密集的优势公式(dense advantage formulation)**
- 根据token对后续轨迹行为的影响重新加权

### 实验结果 (Qwen2.5-32B)
| 指标 | 基线 | FIPO | 提升 |
|------|------|------|------|
| 平均CoT长度 | ~4,000 tokens | >10,000 tokens | 2.5x |
| AIME 2024 Pass@1 | 50.0% | 峰值58.0% (收敛~56.0%) | +8% |

**超越**: DeepSeek-R1-Zero-Math-32B (~47.0%) 和 o1-mini (~56.0%)

### 开源
- 基于verl框架构建的训练系统已开源
- 关键词: future-KL divergence, advantage formulation, dense reward

---

## 对我们的意义

**洞察**: 信用分配(credit assignment)是推理能力的瓶颈

1. **密集奖励 > 稀疏奖励**: 当前系统使用最终结果评估，FIPO提示我们需要更细粒度的中间步骤奖励
2. **轨迹长度与质量**: FIPO证明延长思维链确实能提升准确率——不是简单的"想得更久"，而是"想得更深"
3. **KL散度的作用**: 未来KL作为正则化项，防止模型偏离太远，同时允许探索

---

## 标签
#reasoning #RL #GRPO #credit-assignment #chain-of-thought #qwen
