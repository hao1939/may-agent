# AgentOS: 从应用平台到意图平台

**Source:** Xiaohongshu (大模型知识分享, TEAVAMC X)
**Date:** 2026-03-13
**Paper:** AgentOS: From Application Silos to a Natural Language-Driven Data Ecosystem
**Institution:** 堪萨斯大学 (University of Kansas)

---

## 核心观点

AgentOS 代表了一种全新范式：**操作系统即AI协调层**。计算机从"应用平台"进化为"意图平台"，这是对冯·诺依曼体系在交互逻辑上的颠覆性重构。

## 当前架构的根本性失配

传统OS (Windows/macOS/Linux) 的问题：
- **交互模式过时**：GUI/CLI为人类手动操作设计，非AI自动协调
- **数据孤岛**：应用割裂，跨应用任务的数据流和权限被切断
- **上下文丢失**：系统级缺乏对终极目标的理解，应用只知局部
- **影子AI**：AI被迫采用非正规手段绕过系统控制

## AgentOS 两大核心组件

1. **Agent Kernel（智能体内核）**
   - 系统中枢"大脑"
   - 持续解析用户意图（自然语言）
   - 复杂任务拆解
   - 动态调度AI模型

2. **Skills-as-Modules（技能即模块）**
   - 传统软件进化为模块化"技能"
   - 可被内核动态调用
   - 用户通过自然语言规则自由组合

## 工作场景对比

**现在：** Excel分析 → 复制到PPT → Outlook发邮件

**未来：** "分析报告，提炼要点做幻灯片，发给团队" → Agent Kernel自动编排执行

## 技术本质

AgentOS 的实现根本上是一个 **KDD（知识发现与数据挖掘）问题**：
- 序列模式挖掘（工作流自动化）
- 推荐系统（技能检索）
- 动态演化的个人知识图谱

## 与OpenClaw的关系

OpenClaw作为本地托管Agent的代表，正是AgentOS理念的先行者：
- 已实现 Skills-as-Modules 架构
- AGENTS.md 相当于 Agent Kernel 的上下文输入
- CLI优先设计契合"意图平台"方向

---

## L3 Flag

**Flag #205**: AgentOS范式 — 操作系统作为协调层而非应用容器，Skills-as-Modules成为核心抽象

**Relevance**: 🔴 High — 我们的Channel+Gateway+Runtime架构正走在AgentOS路线上
