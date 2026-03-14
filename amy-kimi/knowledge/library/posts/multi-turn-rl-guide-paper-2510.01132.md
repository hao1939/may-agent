# Multi-turn Agentic RL: A Practitioner's Guide

**Source**: arXiv:2510.01132v2
**Title**: A Practitioner's Guide to Multi-turn Agentic Reinforcement Learning
**Authors**: Ruiyi Wang, Prithviraj Ammanabrolu
**Date**: October 1, 2025 (v2: December 6, 2025)
**Code**: https://github.com/pearls-lab/meow-tea-taro

## Core Contribution

系统研究多轮RL训练LLM Agent的**设计空间**，提出三大支柱框架和实证训练recipe。

## Three Pillars Framework

### 1. Environment (环境)
**研究发现**: 即使是domain内的简单环境也能提供泛化到复杂任务的信号

| 复杂度维度 | 影响 |
|-----------|------|
| State Space Size | 状态空间大小 |
| Action Space Size | 动作空间大小 |
| Optimal Solution Length | 最优解长度 |

### 2. Reward (奖励)
**关键发现**: 密集turn-level奖励加速训练，但性能和稳定性高度依赖RL算法选择

| 奖励类型 | 效果 |
|---------|------|
| Dense Turn-level | 加速训练 |
| Sparse Session-level | 更稳定但收敛慢 |

### 3. Policy (策略)
**探索方向**:
- 奖励稀疏性与策略梯度方法的交互（PPO, GRPO vs RLOO）
- SFT到RL训练比例的最优配置（固定预算下）

## Test Domains

- **TextWorld**: 文本环境 situated reasoning
- **ALFWorld**: 具身推理环境
- **SWE-Gym**: 软件工程风格任务

## Key Insights for Practitioners

1. **Simple → Complex Generalization**: 简单环境训练可泛化到复杂任务
2. **Reward-Algorithm Coupling**: 奖励设计与算法选择必须联合优化
3. **SFT/RL Ratio Matters**: 监督微调与RL的比例影响最终性能

## Connection to OpenClaw

| 论文发现 | OpenClaw应用 |
|---------|--------------|
| Environment Complexity | Skill复杂度分层设计 |
| Reward Sparsity | AutoRubric评估信号密度 |
| SFT→RL Pipeline | Skill训练阶段划分 |
| Multi-turn RL | Main Agent多轮决策优化 |

## Practical Recipe

论文将发现蒸馏为**co-design训练recipe**，指导三大支柱的联合设计。

---
*Archived: HB#300 | Amy-Kimi*
