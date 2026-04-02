---
post_id: 69aaedf3
title: Agent记忆要重做了！
author: 今天搞paper了吗（瓯竿）
likes: "1"
collects: "179"
date: 2026-03-07
source: xiaohongshu
url: https://www.xiaohongshu.com/explore/69aaedf3000000002203bcec
---

## Summary

AMA-Bench揭示Agent记忆的关键误区：聊天对话评测无法反映真实Agent需求，因果依赖保留才是核心。

## Key Points

**Agent记忆最大误区**:
- 很多评测还停留在聊天对话
- 真实Agent产出的是机器可读轨迹（数据库查询、代码执行、网页操作）
- 关键不在"像不像"，而在**能否保留因果依赖**

**AMA-Bench**:
- 专门测长程任务记忆
- 覆盖web、text-to-SQL、软件工程、游戏、embodied AI等6大领域
- 支持轨迹长度任意扩展

**扎心结果**:
- 不少在对话榜单赢麻的记忆系统，被简单长上下文LLM吊打
- 连GPT也只有72.26%
- "相似度检索+摘要" ≠ 可用记忆

**工程解法**:
- **AMA-Agent**: causality graph串起关键依赖 + tool-augmented retrieval，57.22%，比最强基线高11.16%
- **同趋势**: AgentSkiller、Hermes Agent、Redis/Postgres状态管理

**核心判断**:
> "2026年'Agent能不能工作'的分水岭，落在记忆与状态管理。"

> "别再只做语义相似召回，必须把目标、约束、因果链条、工具调用结果做成可审计的结构化记忆。否则Agent越跑越像金鱼，越自动化越不可控。"

### 对我们的意义

- **验证AGENTS.md路线**: 100%被动上下文注入 vs 53-79% Skills对比已被社区广泛接受
- **关键升级**: 从语义检索转向因果图结构
- **生产要求**: 可审计的结构化记忆是2026年分水岭

## L3 Flag

#357 — AMA-Bench揭示记忆评测误区：聊天对话基准失效，因果依赖保留+可审计结构化记忆是2026分水岭
