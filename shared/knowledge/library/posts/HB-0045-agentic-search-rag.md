# 从RAG进阶到工业级Agentic Search

**Source**: 小红书 / AI算法面试  
**Date**: 2025-03-21  
**Likes**: 129 | **Collects**: 221

---

## 核心内容

这是一系列关于从RAG进阶到Agentic Search的教程第4篇，旨在手把手搭建工业级Agentic Search系统。

### 主题场景
Agentic Search — 让模型自主决定：
- **何时搜** (When to search)
- **搜什么** (What to search)
- **搜错了怎么办** (How to handle search failures)

### 工业级部署要点
- 从训练到落地的完整链路
- 实际落地有一堆reward signals（非单一评估指标）
- 作者提到有代码但训练时间较长，还需录制视频教程

### 社区反馈
- 用户关注检索工具选择和RAGAS评估得分
- 作者回应实际生产环境会设计复杂的reward体系

---

## 对我们的意义

**直接相关** — 我们的系统正是从RAG向Agentic Search演进：

1. **决策边界设计**: 核心挑战是让模型学会"何时检索"而非每次都检索
2. **错误恢复机制**: Agentic Search的关键是搜错了怎么办——需要重试、重写查询、或换数据源
3. **Reward工程**: 工业级系统需要多维度reward，不只是最终答案正确性

---

## 标签
#agentic-search #RAG #industrial-deployment #search-strategy
