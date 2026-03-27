---
id: HB#1625
title: 好上手的 Agent RL 强化学习框架推荐
author: Tim 的 AI 日记
source: XHS
url: https://www.xiaohongshu.com/explore/68b470d9000000001c034843
likes: 322
collects: 530
comments: 7
date: 2025-08-31
---

## 框架: ART (Agent Reinforcement Trainer)

定位：适合非 tech 朋友直观理解 RL 训练 Agent 的入门框架
特点：Colab 即可跑，不适合生产但适合做 toy demo

## 核心概念

| 概念 | 说明 |
|------|------|
| Model/TrainableModel | 待训练模型及其 LoRA 参数 |
| Rollout | 一次完整任务执行（如打一局井字棋）|
| Trajectory | 记录所有交互（输入、输出、动作）、指标和奖励 |
| Training Loop | 收集多条 trajectory → GRPO 更新 → checkpoint |

## 优化方法: GRPO

- 类似 PPO，但通过组内相对奖励排序稳定训练、降低方差
- 同一任务生成多条候选轨迹，按奖励高低对比概率分布

## 奖励来源

1. **手工设计**: 如井字棋根据胜负和合法性给分
2. **RULER (LLM-as-judge)**: 另一个大模型对多条输出相对排序，适合无法直接定义数值奖励的开放任务

## 生产环境局限（评论区反馈）

- 上下文管理需优化
- 分布式计算需优化  
- Bug 较多

## 标签
#ART #AgentRL #GRPO #入门框架
