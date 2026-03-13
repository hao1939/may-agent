---
post_id: 69b19117
author: momo
title: Agent记忆不能只会存
date: 2026-03-12
likes: 67
collects: 75
---

## 论文
Remember Me, Refine Me: A Dynamic Procedural Memory Framework for Experience-Driven Agent Evolution

## 核心洞察

### TL;DR
ReMe这条线最值得注意的，不只是"agent终于有长期记忆了"，而是**长期记忆正在被拆成独立能力层**。它同时强调记忆的写入、检索和更新，让memory不再只是向量库挂件，而更像agent runtime里的正式模块。

### 研究动机
过去很多agent memory方案的问题在于：要么只是存，要么只是取，很少认真处理"什么时候写、什么时候调、什么时候忘"。一旦任务拉长，记忆系统就会面临：
- 脏信息累积
- 检索时机不稳
- 经验无法复用

### 方法简介
ReMe的核心思路是把memory管理拆成完整生命周期：
1. 从历史执行里提炼可复用经验
2. 根据当前场景做更合适的调用
3. 持续更新和精炼memory池

让旧经验不是越积越乱，而是逐步变成更高质量的procedural memory。

### 实验和结论
这类工作真正推进的，不只是让agent"记得更多"，而是让memory变得更可控、更能服务长期执行。memory schema、retrieval timing和forgetting policy，都会变成skill-aware agent system里可以单独研究的问题。

## 评论
晚："感觉是很工程的工作"

## 标签
#人工智能 #Agent #长期记忆 #Memory #Skill #多智能体

## 洞察价值
L1 - 记忆系统演进：ReMe提出记忆完整生命周期（写入-检索-更新），验证我们的三层记忆架构方向正确
