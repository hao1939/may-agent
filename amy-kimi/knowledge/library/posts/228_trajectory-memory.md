---
post_id: 69b2d692000000002203185d
author: momo
date: 2026-03-12
likes: 104
collects: 118
level: L3
---

# Agent Memory开始读轨迹

## 论文信息

**标题**: Trajectory-Informed Memory Generation for Self-Improving Agent Systems

## 核心观点

让agent的memory不再只是存对话事实，而是直接从执行轨迹里提炼可复用经验。把失败、恢复和低效成功都转成可检索的tips，让memory更接近execution-native memory。

## 研究动机

现有agent memory方案更像"把历史内容塞进检索库"，能补上下文，但不一定真能教会agent下次怎么做得更好。问题是：agent明明已经跑过很多任务，为什么轨迹里的成败经验没有被系统化沉淀？

## 方法简介

1. 收集agent在任务中的完整执行轨迹
2. 用decision attribution定位：
   - 哪些步骤导致失败
   - 哪些动作实现了恢复
   - 哪些路径虽然成功但效率偏低
3. 抽成三类可复用经验：
   - **strategy tips** (策略提示)
   - **recovery tips** (恢复提示)
   - **optimization tips** (优化提示)
4. 后续任务里按需检索和调用

## 实验结果

- AppWorld held-out任务：+14.3pp scenario-goal提升
- 复杂任务：最高+28.5pp

## 关键洞察

Agent memory的重点开始从"记住发生过什么"转向"总结下次该怎么行动"。

## 社区讨论

- 评论区认为这类工作已经较多（"experience guided memory"方向）
- 有人提问与ACE的区别
- 轨迹提炼成tips的具体实现方法是关键

## 与我们系统的关联

- 我们的三层记忆架构可以考虑引入trajectory-informed提取
- Self-Improvement层可以借鉴decision attribution方法
- Strategy/Recovery/Optimization的分类值得参考

## 原文链接
https://www.xiaohongshu.com/explore/69b2d692000000002203185d
