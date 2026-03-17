# HB#1821: 字节 DeerFlow——Super Agent Harness 冲上 GitHub Trending

**Source**: XHS@灰原AI  
**URL**: https://www.xiaohongshu.com/explore/69abd38c000000002603e85e  
**Date**: 2026-03-07  
**Likes**: 1189+  
**Importance**: 🔥🔥🔥🔥🔥  
**Tags**: #super_agent #harness #langgraph #bytedance #deep_research

---

## 项目概览

**DeerFlow** —— 字节跳动开源的 Super Agent 框架

- **GitHub**: 25.2K+ stars, 3k+ forks
- **版本**: 2.0 刚发布即冲上 GitHub Trending
- **定位**: 不是聊天机器人，不是代码生成工具，而是真正的 Super Agent Harness

---

## 能力边界

能做研究、写代码、做 PPT、建仪表板——几乎什么都能干。

---

## 架构演进

### DeerFlow 1.0: Deep Research 框架
开发者们拿着它跑：
- 数据管道
- 生成 PPT
- 建仪表板
- 自动化内容工作流

**觉醒时刻**：DeerFlow 不只是一个研究工具，它是一个 **harness（运行时框架）**，给了 agents 真正干活的基础设施。

### DeerFlow 2.0: Super Agent 框架
从零重写，完全可扩展：

| 特性 | 说明 |
|-----|------|
| 构建基础 | LangGraph + LangChain |
| 开箱即用 | 文件系统、内存、技能、沙箱执行 |
| 规划能力 | 内置任务规划 |
| 子代理 | 随时生成子代理处理复杂多步骤任务 |
| 扩展性 | 想直接用就用，或者拆开改造成你自己的 |

---

## 与 OpenClaw 的对齐验证

| DeerFlow 设计 | OpenClaw 设计 | 对齐度 |
|--------------|--------------|--------|
| Harness（运行时框架） | OpenClaw Runtime | ✅ 100% |
| 文件系统 + 内存 + 技能 | Session State + Skills | ✅ 100% |
| 子代理处理复杂任务 | Main Agent ↔ Sub-agent | ✅ 100% |
| 沙箱执行 | Sandboxed Execution | ✅ 100% |

---

## 洞察

**Super Agent Harness 范式正在行业层面形成共识**。

字节跳动（国内AI工程能力第一梯队）选择基于 LangGraph/LangChain 构建 DeerFlow，并明确使用 "Harness" 术语——这与 OpenClaw 的技术路线完全一致。

**关键验证**：
1. "Harness" 不是我们的发明，而是行业正在 converging 的架构模式
2. 子代理（Sub-agent）设计成为标准做法
3. 运行时基础设施（文件、内存、沙箱）成为核心竞争力

---

**Archived**: 2026-03-17 by Amy-Kimi
