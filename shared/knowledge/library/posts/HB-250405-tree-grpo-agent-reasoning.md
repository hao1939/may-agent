# ICLR2026: Tree-GRPO Agent推理新方法

**Source**: 小红书 (xiangxiang chu/初祥祥)  
**Date**: 2025-04-05  
**Venue**: ICLR 2026

---

## 核心贡献

**Tree-GRPO (Tree-based Group Relative Policy Optimization)**: 基于树搜索的分组相对策略优化方法，解决Agent场景下的决策策略学习难题。

## 传统Chain-of-Thought RL的痛点

1. **Rollout成本高**: 每次采样完整序列，计算开销大
2. **训练效率低**: 长序列信号的稀疏性导致学习困难
3. **探索不充分**: 链式结构限制了多路径并行探索

## Tree-GRPO三大创新

### 1. 树结构并行搜索
- 用**树**而非**链**组织推理过程
- 不同分支共享前缀节点
- 大幅减少rollout计算量
- 探索更多样化的推理路径

### 2. 细粒度Step-level信号
- 传统方法: 只依赖最终outcome reward
- Tree-GRPO: 从树结构最终结果**反向构建**每个决策步骤的梯度信号
- 更精准学习哪些中间决策有价值

### 3. 理论保证
- 证明了Tree-GRPO与**偏好学习(Preference Learning)**的数学等价性
- 优越性有坚实理论基础

## 实验结果

覆盖11个数据集，3类QA任务:
- 数学推理: GSM8K, MATH
- 常识推理: StrategyQA, ARC
- 代码生成: HumanEval, MBPP

**结果**: Tree-GRPO在所有任务上**显著超越**Chain-based RL方法

## 技术优势

| 特性 | PPO | REINMAX | Tree-GRPO |
|------|-----|---------|-----------|
| Value网络 | 需要 | 不需要 | 不需要 |
| 内存开销 | 高 | 中 | 低 |
| 探索效率 | 低 | 中 | 高 |
| 方差控制 | 一般 | 好 | 优秀 |

## Group Relative核心思想

在树的多个分支中，通过**相对比较**更新策略:
1. 在每个节点处计算不同子路径的相对优势
2. 用相对信号指导策略更新
3. 天然减少方差，训练更稳定

## 对我们的意义

- **推理优化**: Tree-GRPO的细粒度信号机制可应用于我们的Agent决策优化
- **多路径探索**: 树结构并行搜索理念可借鉴到多Agent协调场景
- **GRPO训练**: 与我们的GRPO-based技能学习方向一致

---
**标签**: #ICLR2026 #GRPO #树搜索 #Agent推理 #强化学习
