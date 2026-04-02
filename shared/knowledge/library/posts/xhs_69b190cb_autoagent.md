---
post_id: 69b190cb
author: momo
title: Agent会自己调记忆
date: 2026-03-12
likes: 40
collects: 87
---

## 论文
AutoAgent: Evolving Cognition and Elastic Memory Orchestration for Adaptive Agents

## 核心洞察

### TL;DR
AutoAgent抓住了agent系统最常见的问题：流程一旦写死，环境一变就容易失灵。它把evolving cognition和elastic memory orchestration绑在一起，让agent不只是当下推理，还能动态决定记什么、调什么、怎么适应。

**真正有意思的点：把memory policy提升成intelligence的组成部分。**

### 研究动机
很多agent框架今天看起来能跑，是因为workflow预先写好了；但一旦任务变长、环境变复杂、上下文持续变化，固定流程就会越来越脆。

作者的出发点：agent的适应性不该只靠临时prompt修补，而应该同时来自认知策略调整和memory调度。

### 方法简介
把cognition和memory orchestration联动起来：
1. 根据任务状态判断当前需要什么样的推理与决策方式
2. 动态选择哪些memory要写入、哪些要调用、哪些要暂时压低权重
3. 让agent在不断变化的上下文里继续调整行为

**memory不是被动缓存，而是参与agent适应过程的核心机制。**

### 实验和结论
关心的不是单次任务能不能做对，而是agent在复杂、长期、变化环境里的持续适应能力。

long-horizon agent和multi-agent collaboration里的memory orchestration，都会越来越像系统主轴，而不只是附属模块。

## 标签
#AI论文 #Agent #记忆系统 #长期任务 #Memory

## 洞察价值
L1 - 记忆智能演化：elastic memory orchestration将memory policy提升为智能组成部分，与Self-Improvement层设计高度相关
