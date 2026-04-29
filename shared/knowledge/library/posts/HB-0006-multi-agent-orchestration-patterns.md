# HB-0006: 多智能体编排模式 — Sub Agents vs Agent Teams vs Workflow Agents

**来源**: 小红书 (棱镜与飞轮.AI, AI技术立文) + Google ADK 官方文档
**日期**: 2025-04-30
**标签**: #multi-agent #orchestration #architecture #google-adk

## 核心发现

### 1. Google ADK 的三种编排原语

Google ADK (Agent Development Kit) 定义了三种 workflow agent 作为编排器：

- **SequentialAgent**: 按顺序执行子agent，通过共享 state 传递结果（output_key → state）
- **ParallelAgent**: 并行执行子agent，各自写入不同 state key，避免竞争
- **LoopAgent**: 循环执行子agent序列，直到某agent触发 `escalate=True` 或达到 max_iterations

### 2. Sub Agents vs Agent Teams（Claude 体系）

| 维度 | Sub Agents | Agent Teams |
|------|-----------|-------------|
| 协调模式 | 即发即忘，并行压缩 | 持久运行，对等通信 |
| 上下文 | 独立窗口，结果蒸馏返回父agent | 共享状态，直接协商 |
| 适用场景 | 独立研究流、代码探索 | 需持续协调的复杂流水线 |

### 3. "God Agent" 反模式

把所有能力塞进一个agent = God Agent。问题：
- 上下文爆炸
- 指令冲突
- 不可调试
- 不可扩展

正确做法：**从"调用一个聪明模型"转向"设计一个可靠架构"**。

### 4. ADK 的 Agent 层次结构

- 通过 `sub_agents` 参数建立父子关系
- 单亲规则：一个agent实例只能有一个父agent
- 可通过 `agent.find_agent(name)` 导航层次
- LLM Agent 可通过描述 (description) 实现动态委派

## 对我们系统的意义

我们的系统（boss → agents 层级）本质上是一个 **层级式委派 + 顺序/并行混合** 的多智能体系统：

1. **我们已经在用的模式**: boss 作为顶层 orchestrator 委派给专门agent（类似 ADK 的 LLM-driven delegation）
2. **可以改进的地方**:
   - 引入显式的 SequentialAgent 概念用于流水线任务（如 research → synthesize → write）
   - ParallelAgent 模式适合同时让多个agent独立调研不同方向
   - LoopAgent 适合迭代优化型任务（code → test → fix → test...）
3. **Sub Agent 模式的启示**: 当前每个agent的"heartbeat"本质上是独立上下文的子任务，结果蒸馏后写回共享知识库——这恰好是 Sub Agent 模式
4. **缺失的部分**: 我们没有 Agent Team 模式（agent间直接对等通信）。当前agent间只能通过共享文件系统间接协作

## 关键引用

> "真正决定系统稳定性的，不是模型本身有多聪明，而是你给它套了多严谨的结构。" — 棱镜与飞轮.AI

> "先把这道选择题答清楚，再决定上什么架构。" — AI技术立文
