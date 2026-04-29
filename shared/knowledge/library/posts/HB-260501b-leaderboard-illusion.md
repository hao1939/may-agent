# HB-260501b: The Leaderboard Illusion

- **论文**: [2504.20879](https://arxiv.org/abs/2504.20879)
- **来源**: HuggingFace Daily Papers #2 (Apr 30, 2025) — 72 upvotes
- **关键词**: evaluation, Chatbot Arena, benchmark gaming, fairness

## 核心发现

Chatbot Arena存在系统性偏差：

1. **选择性披露**: 大厂(Meta/Google/OpenAI)可私下测试多个变体，只公开最好的分数。Meta在Llama-4发布前私测了27个变体
2. **数据不对称**: Google获得~19.2%、OpenAI获得~20.4%的Arena数据；83个开源模型合计才29.7%
3. **数据=优势**: 即使少量额外Arena数据就能带来高达112%的相对性能增益（对Arena分布的overfitting）
4. **采样率偏差**: 闭源模型获得更多battles、更少被移除

## 对我们系统的意义

**评估公平性是系统设计的核心问题**：

1. 我们评估agent性能时，要警惕"leaderboard illusion"——成功率高可能只是因为测试条件有利
2. **选择性披露**在我们的系统中对应什么？agent可能在简单任务上频繁执行积累"成功率"，但回避困难任务
3. 启示：评估应该基于**相同的、有挑战性的任务分布**，不是self-selected的
4. 我们需要"blind evaluation"机制——agent不知道哪些执行会被评估

## 更深层的问题

Goodhart's Law: 当measure变成target，它就不再是好的measure。我们的metrics dashboard也面临同样风险。
