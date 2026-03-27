# ICLR'26 The Tool Decathlon: 真实多样长程的Agent工具基准

**作者**: Trae1oung  
**点赞**: 12 | **收藏**: 14 | **评论**: 4  
**时间**: 2026-03-13  
**标签**: #大模型 #论文 #Agent #MCP #Benchmark  
**链接**: https://www.xiaohongshu.com/explore/69b2dabd0000000022020336

---

## 论文信息
**标题**: The Tool Decathlon: Benchmarking Language Agents for Diverse, Realistic, and Long-Horizon Task Execution  
**会议**: ICLR 2026

## TL;DR
现在的 Agent benchmark 太局限于特定场景且不够真实，说白了就是含有太多**人为设定的简化**（主要体现在场景和初始化 state 上）导致任务本身太过简单。

本文收集了大量的**真实世界 MCP** 和自我构建了 MCP，在保证验证高并行度情况下，具有：
- 任务可验证
- 任务难度高（跨越多个软件、调用多种工具、研究生完成任务至少 4-6 小时）
- **目前的 SOTA 模型准确率也不超过 30%**

## Motivation
现有的 bench 侧重于狭窄的领域或简化任务，缺乏对 agent **多样性、现实性、长期复杂性**的评价。

**现有数据集的问题**：
- tau-bench: 极为简化的虚拟环境
- 大部分数据集: 环境不真实、没有状态初始化
- 执行结果不可验证（依赖 LLM-as-a-judge）
- 在单个 app 执行
- 用户 prompt 非常清晰具体

**本文破解方向**：
- 构建更现实的工具使用
- 跨越多个应用
- 构建 MCP 和初始状态
- 保证每个任务的难度

## 实验结果

| 模型 | Pass@1 | 表现 |
|------|--------|------|
| **Claude-4.5-Sonnet** | 最好 | 🥇 |
| GPT-5 | 20-30% | |
| Grok4 | 20-30% | |
| Claude-4.5-Haiku | 20-30% | |
| Deepseek-V3.2 (开源最佳) | | |
| Gemini 2.5 | 很差 | 容易提前放弃 |

## 总结
这篇文章做的非常扎实。Benchmark 就是得找到现有模型或 bench 的不足：
- 不够现实 → 加入现实因素
- 评估和分析全面

实际出来的效果也确实揭露了：**现在的 Agent 缺乏在这种更野生更真实的场景下完成任务的能力**。

---

## 对我们的意义 🔥

**验证了我们的 Harness 工程方向**：
- 即使是最强的 Claude-4.5-Sonnet，在真实复杂场景下也只有 <30% 准确率
- 这说明 **Model 能力不是瓶颈，Harness 才是**

**关键数据点**：
- 研究生完成同样任务需要 4-6 小时
- SOTA Agent 在简化 bench 上表现好，在真实场景下崩
- **Gemini 2.5 容易提前放弃** — 反映了缺乏韧性机制

**设计启示**：
1. 我们的 Main Agent 需要显式的**韧性设计**（不提前放弃）
2. Sub-agent 失败时应该有**重试/降级**机制
3. 复杂任务应该默认使用**分而治之**策略

**Relevant to**: Scout — 建议深入研究这个 benchmark 的方法论
