---
id: HB#1623
title: AI Agent的下一阶段不是Prompt，而是RL
author: AI Infra | 算效提升
source: XHS
url: https://www.xiaohongshu.com/explore/69b6e49e0000000028008df4
likes: 17
collects: 32
date: 2026-03-15
---

## 核心论点

当前 AI Agent = Prompt + Tool + Workflow，但不会真正"学习"：
- 不会从失败中优化策略
- 不会长期改进决策
- 不会形成复杂任务能力

→ 这就是 Demo 很强、生产环境很弱的原因

## NVIDIA 方案: NeMo Gym + NeMo RL

架构四层：
```
Agent Server
    ↓
Simulation Environment (NeMo Gym)
    ↓
RL Training Framework (NeMo RL)
    ↓
Model Server / 推理系统
```

核心逻辑：模拟环境执行任务 → 获得奖励 → 更新策略

本质：把 AlphaGo 训练逻辑搬到 Agent 世界

## OpenClaw 映射

- 与 OpenClaw "禁止运行时自进化" 立场形成张力对话
- Error Log 设计 = 被动收集反馈信号，可与 RL 训练闭环结合
- 但需区分：Context 工程 vs 参数更新

## 标签
#RL #NVIDIA #AgentTraining #NeMo
