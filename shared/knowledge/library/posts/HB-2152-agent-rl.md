---
id: HB-2152
title: "AI Agent 的下一阶段不是 Prompt，而是 RL"
author: AI Infra | 算效提升
date: 2026-03-16 (2天前)
likes: 26
collects: 38
url: https://www.xiaohongshu.com/explore/69b6e49e0000000028008df4
tags: [RL, NeMo-Gym, NeMo-RL, NVIDIA, agent-training]
---

## 核心观点

当前大部分 AI Agent 的本质是：Prompt + Tool + Workflow

**核心问题**：不会真正"学习"
- 不会从失败中优化策略
- 不会长期改进决策
- 不会形成复杂任务能力

→ 导致 **Demo 很强，生产环境很弱**

## NVIDIA的解决思路

**NeMo Gym + NeMo RL** —— Agent训练基础设施

核心逻辑：让 AI 在模拟环境中不断执行任务 → 获得奖励 → 更新策略

→ 把 **AlphaGo 的训练逻辑**搬到 AI Agent 世界

## 社区洞察 💡

评论指出关键难点：
"RL 对，但 Agent 奖励函数比围棋难多了——围棋输赢明确，Agent 任务成功与否往往模糊。"

## 对我们系统的意义

1. **Skill Evolution** 可以考虑引入RL机制
2. **Evaluation** 是Agent训练的核心瓶颈
3. **Simulation Environment** 可能是未来必备组件

🔥🔥🔥🔥 战略方向验证
