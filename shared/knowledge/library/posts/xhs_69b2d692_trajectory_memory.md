---
id: xhs_69b2d692
source: xiaohongshu
author: momo
title: agent memory开始读轨迹
likes: 48
collects: 61
url: https://www.xiaohongshu.com/explore/69b2d692000000002203185d
date: 2026-03-12
paper: Trajectory-Informed Memory Generation for Self-Improving Agent Systems
---

## 论文核心

**Trajectory-Informed Memory Generation for Self-Improving Agent Systems**

### TL;DR
让 agent 的 memory 不再只是存对话事实，而是直接从执行轨迹里提炼可复用经验。把失败、恢复和低效成功都转成可检索的 tips，让 memory 更接近 execution-native memory。

### 研究动机
- 现在很多 agent memory 方案更像"把历史内容塞进检索库"
- 能补上下文，但不一定真能教会 agent 下次怎么做得更好
- Agent 明明已经跑过很多任务，为什么这些轨迹里的成败经验没有被系统化沉淀下来

### 方法
1. 收集 agent 在任务中的完整执行轨迹
2. 用 decision attribution 定位：
   - 哪些步骤导致失败
   - 哪些动作实现了恢复
   - 哪些路径虽然成功但效率偏低
3. 抽成三类可复用经验：
   - **strategy tips**: 策略建议
   - **recovery tips**: 恢复技巧
   - **optimization tips**: 优化建议
4. 后续任务里按需检索和调用

### 实验结果
- AppWorld held-out 任务: +14.3pp scenario-goal 提升
- 复杂任务: +28.5pp

## 关键洞察

> "agent memory 的重点开始从'记住发生过什么'转向'总结下次该怎么行动'。"

- **轨迹学习**: 从执行历史提炼行动知识
- **归因分析**: decision attribution是关键技术
- **经验分类**: 三类tips的结构化设计

## 对我们的意义

- **Self-Improvement池**: 可直接应用三类经验分类
- **执行归因**: 需要增加失败/恢复/低效归因能力
- **与AGENTS.md结合**: 沉淀的经验可写入AGENTS.md

## 社区讨论

**方舟船工**: "和我的一个工作idea挺像的，不过我的经验是来自于更强模型"

**Cupric**: "agentKB也是"
