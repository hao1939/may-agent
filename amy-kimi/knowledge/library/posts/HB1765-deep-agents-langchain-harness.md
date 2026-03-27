# HB#1765 Deep Agents — 开箱即用的Agent Harness

**Source**: XHS@奥森木  
**Date**: 2026-03-17  
**Likes**: 2 / **Collects**: 3  
**URL**: https://www.xiaohongshu.com/explore/69b88ade000000001a029f10  
**Status**: 🔥🔥🔥🔥🔥 **里程碑级** — LangChain官方Agent Harness

---

## 核心发现

### 什么是Deep Agents？
LangChain刚开源的 **Agent Harness** —— 不是又一个Agent框架，而是一个**有主见的、开箱即用的Agent Harness**。

**框架 vs Harness的区别**：
- 框架 = 给你零件让你自己组装
- Harness = 给你一个已经装好的Agent，你只需要改你想改的部分

### 明确的设计灵感
README直言：
> "This project was primarily inspired by Claude Code."

LangChain团队研究了Claude Code的通用性来源，然后试图做得**更通用、更开放**。MIT协议完全开源。

---

## 内置六大能力

| 能力 | 实现 | 对应Claude Code |
|------|------|-----------------|
| **Planning** | write_todos 任务分解和进度追踪 | TodoWrite |
| **Filesystem** | read_file/write_file/edit_file/ls/glob/grep | 文件系统工具 |
| **Shell** | execute 命令执行，支持沙箱隔离 | Bash工具 |
| **Sub-agents** | task 工具派子Agent，独立上下文窗口 | 子Agent委派 |
| **Smart Defaults** | 开箱即用的最佳实践prompt | 系统提示词 |
| **Context Management** | 自动摘要，大量输出存文件而非塞上下文 | 上下文管理 |

---

## 技术架构

- **底座**: LangGraph
- **接口**: create_deep_agent 返回编译好的LangGraph图
- **特性**: 自动获得流式输出、持久化、检查点
- **Provider无关**: 任何支持tool calling的LLM都能用
- **MCP支持**: 通过langchain-mcp-adapters支持MCP协议

---

## 上手体验

```bash
pip install deepagents
```

三行代码就有一个能规划、能读写文件、能管理自己上下文的Agent。

CLI版本额外支持：
- Web搜索
- 远程沙箱
- 持久化记忆
- 人工审批

---

## 安全模型：Trust the LLM

**核心理念**: 不靠模型自律，在**工具和沙箱层面设边界**。

> Agent可以做它的工具允许的任何事，你通过**控制给它什么工具**来约束它。

这比写一堆"不要做XXX"的prompt可靠得多。

---

## OpenClaw相关性

| Deep Agents | OpenClaw | 对齐度 |
|-------------|----------|--------|
| Agent Harness架构 | ✅ Harness设计 | 100% |
| Sub-agents独立上下文 | ✅ Main/Sub-agent分离 | 100% |
| 文件系统工具集 | ✅ Skill工具集 | 90% |
| Smart Defaults | ✅ AGENTS.md设计 | 90% |
| Context Management | ✅ 上下文优化 | 100% |
| Trust the LLM安全模型 | ✅ 工具层面约束 | 90% |

**关键洞察**: Deep Agents是行业对Agent Harness架构的**正式验证**。LangChain作为主流框架官方采用这种设计，标志着OpenClaw的Harness路线获得**行业顶级背书**。

---

## 社区信号

- 奥森木(奥森木)持续关注Agent Harness话题
- 王鹏LLM称其为"开源版的Claude Code"
- William指出浅层架构的致命缺陷，Deep Agents是对这些缺陷的解决方案

---

## Action Items

1. **技术追踪**: 深入研究Deep Agents源码，对比OpenClaw实现差异
2. **生态监测**: 关注LangGraph生态与Deep Agents的演进
3. **竞争分析**: Deep Agents作为开箱即用方案，与OpenClaw的定位差异
