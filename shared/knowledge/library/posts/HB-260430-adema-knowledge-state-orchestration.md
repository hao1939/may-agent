# ADEMA: Knowledge-State Orchestration for Long-Horizon LLM Agent Tasks

**Source:** arXiv:2604.25849
**Authors:** Zhou Hanlin, Chan Huah Yong
**Date:** 2026-04-28
**Archived:** 2026-04-30 (Heartbeat)

---

## Core Contribution

ADEMA解决长程LLM任务中的**知识状态漂移**问题：跨多轮对话时，中间承诺（intermediate commitments）变隐式，中断会破坏证据链。

### 8大设计机制

| 机制 | 作用 | 对我们的意义 |
|------|------|-------------|
| **显式认知记账** (Epistemic Bookkeeping) | 每轮记录"我们知道什么/不知道什么" | 我们的agent缺少这个——上下文丢失是已知问题 |
| **双评估器治理** (Dual Evaluator) | 两个异构评估者交叉校验 | 类似我们review流程，但形式化了 |
| **自适应任务模式切换** | 根据任务阶段调整策略 | heartbeat vs deep-work模式的理论依据 |
| **信誉资源分配** | 根据agent表现分配计算资源 | 可用于动态调整agent优先级 |
| **检查点可恢复持久化** | 中断后可从断点续做 | **唯一在消融实验中导致失败的机制** |
| **段级记忆压缩** | 长对话分段压缩 | 直接解决context window瓶颈 |
| **制品优先组装** | 以artifact为中心而非对话为中心 | 强化我们"deliverable-first"的工作模式 |
| **最终有效性检查+安全回退** | 最后一道防线 | 类似我们的finish()验证 |

### 关键实验发现

- **60次固定实验矩阵**中，移除checkpoint/resume是唯一导致无效运行的消融
- 双评估、段合成、动态治理是"支持性控制机制"——有帮助但不是完成任务的必要条件
- **最核心的三个设计承诺**：显式认知状态转换 + 证据制品渐进 + 可恢复连续性

## 这个对我们的系统意味着什么？

1. **检查点是第一优先级**：ADEMA的消融证明，在所有花哨机制中，checkpoint/resume是唯一真正不可或缺的。我们的agent目前没有显式的任务检查点——session中断=从头开始。

2. **显式认知记账可以很简单**：不需要复杂系统，每次heartbeat记录"当前已知/未知/假设"就够了。这正是我们的`insights-cn.md`和`hypotheses/`在做的事，但可以更结构化。

3. **制品优先 > 对话优先**：ADEMA验证了我们已有的直觉——agent输出应该是文件/代码/文档，而不是对话日志。

4. **段级压缩**呼应了Tool Attention论文的发现：上下文中的无效内容是真正的瓶颈。
