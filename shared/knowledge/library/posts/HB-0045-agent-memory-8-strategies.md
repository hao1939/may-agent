# Agent的8种记忆策略

**Source:** XHS @Erric的AI产品求职-匡集  
**Date:** 2025-11-17  
**Engagement:** 682 likes, 1155 collects  
**URL:** https://www.xiaohongshu.com/explore/691b0b3b000000000d00e44c

---

## Overview

这篇帖子详细总结了8种AI Agent记忆管理策略，从简单的全量记忆到复杂的类操作系统内存管理，提供了图解和代码示例。

---

## 8种记忆策略详解

### 1️⃣ 全量记忆 (Full Memory)
**不遗忘任何内容**
- 每轮对话将用户输入与智能体响应完整记录
- 后续请求中将全部历史上下文一并发给LLM
- 优点：信息完整无丢失
- 缺点：上下文窗口快速耗尽，成本高

### 2️⃣ 滑动窗口 (Sliding Window)
**固定长度的截断**
- 维护固定大小的队列作为对话窗口
- 新对话加入时，超过窗口大小则移除最旧的一条
- 简单高效，适合短对话场景

### 3️⃣ 相关性过滤 (Relevance Filtering)
**遗忘次要信息**
- 优先保留重要信息，丢弃无用细节
- 基于信息重要程度管理记忆，而非简单抛弃旧记忆
- 需要重要性评估机制

### 4️⃣ 摘要/压缩 (Summarization/Compression)
**提炼关键信息**
- 缩短对话长度，去除无用信息（寒暄、闲聊、重复信息）
- 浓缩成关键要点保存
- 平衡了信息完整性和上下文长度

### 5️⃣ 向量数据库 (Vector Database)
**语义检索记忆**
- 将对话内容在向量库存储
- 需要时通过语义检索相关记忆
- 实现近乎无限的外部长时间记忆

### 6️⃣ 知识图谱 (Knowledge Graph)
**结构化记忆**
- 以结构化方式存储和组织记忆信息
- 通过显式的实体、属性和关系增强长期结构化记忆和推理能力
- 适合复杂关系型知识

### 7️⃣ 分层记忆 (Hierarchical Memory)
**短期与长期结合**
- 将不同类型、重要程度的信息存入不同层级的存储系统
- 让智能体在面对不同场景时都能"对症下药"
- 类似人类记忆的 working memory + long-term memory

### 8️⃣ 类OS内存管理 (OS-like Memory Management)
**模拟Swap原理**
- 将有限的上下文窗口当作RAM使用
- 超出上下文的信息保存到外部存储（Page Out）
- 必要时再"交换"回来（Page In）
- 最复杂但最接近操作系统级优化

---

## Implications for Our System

**Memory is a first-class concern in agent design.** Different strategies suit different use cases:

| Strategy | Best For | Complexity |
|----------|----------|------------|
| Sliding Window | Quick prototypes, short conversations | Low |
| Vector DB | Long-term knowledge, semantic search | Medium |
| Knowledge Graph | Structured relationships, reasoning | High |
| Hierarchical | Production systems with mixed needs | High |

Our current system should evaluate:
1. What's our current memory strategy? (likely sliding window or full memory)
2. When do we hit context limits?
3. Would vector DB integration improve long-term task performance?

---

## Tags
#memory #agent-architecture #llm-context #vector-db #knowledge-graph
