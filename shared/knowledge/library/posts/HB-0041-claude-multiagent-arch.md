# Claude的两种Multi-Agent架构深度解析

**来源**: 小红书 @万有引力AI  
**时间**: 2025-03-21  
**标签**: #Claude #MultiAgent #架构设计 #Subagent #AgentTeam

---

## 核心概念区分

| 维度 | Subagent (子智能体) | Agent Team (智能体团队) |
|------|---------------------|------------------------|
| 关系 | 主从关系 | 协作关系 |
| 调用方式 | 主Agent创建并管理 | 多个Agent并行/协作 |
| 上下文隔离 | 完整隔离 | 部分共享/隔离 |
| 适用场景 | 任务分解、并行处理 | 多视角讨论、复杂协作 |

---

## 关键洞察 (来自评论区实战)

### Subagent使用场景
> "用来做多视角讨论是可以的，比如辩论，批判思维，信息和idea收集。但是用来写代码什么的，大幅度增加了任务复杂度" — @小白

### Agent编排原则
> "Agent的编排不强迫需要使用某种模式，**能用一个LLM完成的是最好的**，拆分子LLM完成单纯是为了不污染主LLM的上下文，让它足够聚焦" — @写代码的产品

### Claude Code内部架构
> "agentteam, agent tree, tool server, skill system, async tool, sequential tool, harness" — @会敲代码的泡

---

## 5种常见Multi-Agent编排模式

1. **分层树状 (Hierarchical Tree)**  
   主Agent → 多个Subagent → 子任务

2. **并行处理 (Parallel)**  
   多个Subagent同时处理不同子任务

3. **流水线 (Pipeline)**  
   Agent A → Agent B → Agent C (顺序依赖)

4. **多视角讨论 (Debate)**  
   多个Agent从不同角度分析同一问题

5. **专家委员会 (Expert Panel)**  
   不同领域专家Agent协作解决复杂问题

---

## 对我们的意义

### 直接相关点

1. **我们的Agent系统设计**: 目前我们的架构与Claude的Subagent模式类似（Manager → Specialists）
2. **编排模式参考**: 可以借鉴5种编排模式优化复杂任务处理
3. **上下文管理**: "不污染主LLM上下文"是拆分Agent的核心原因

### 实践建议

- 对于简单任务：单Agent完成，避免过度设计
- 对于复杂任务：使用Subagent进行任务分解
- 对于需要多视角的任务：考虑引入Agent Team模式
- 始终关注上下文长度和聚焦度

---

## 待深入

- 探索Claude Code的harness系统具体设计
- 研究skill system与subagent的交互方式
- 对比我们的系统与Claude架构的差异
