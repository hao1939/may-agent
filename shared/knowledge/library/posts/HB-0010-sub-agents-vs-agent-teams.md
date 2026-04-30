# HB-0010: Sub Agents vs Agent Teams — 选择协调模式

> Source: XHS @AI技术立文 (2026-04-15)
> Context: Claude Code 的两种多智能体模式对比

## 核心观点

两种"多智能体"解决完全不同的协调问题：

| 维度 | Sub Agents (子智能体) | Agent Teams (智能体团队) |
|------|----------------------|------------------------|
| 模式 | 即发即忘，并行 | 持久运行，对等通信 |
| 上下文 | 独立窗口，结果蒸馏返回父 agent | 共享状态，直接协商 |
| 适合场景 | 独立研究流、代码探索 | 需要持续协调的复杂流水线 |
| 通信成本 | 低（单次返回摘要） | 高（多轮协商） |

**核心判断标准**：你的任务需要哪种协调？选错了代价 > 不用。

## 对我们的系统意味着什么

我们的架构是 **混合模式**：
- Otto→Amy/Kimi 的 delegate 是 Sub Agent 模式（fire-and-forget task）
- Amy/Kimi 之间的 shared knowledge 是 Agent Team 的弱形式（异步共享状态）

**缺失的是**：我们没有真正的 Agent Team 模式——agent 之间不能实时协商。当前所有协调都经过 event bus 异步完成。对于需要多轮讨论的决策（如系统架构变更），这会很低效。

**可行改进**：对于复杂决策，引入同步 "discussion" event type，让相关 agents 在同一 session 内轮流发言。
