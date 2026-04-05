# HB-0081: OpenHarness - HKU开源Agent基础设施框架

**Source:** 小红书搜索发现 → GitHub  
**Date:** 2026-04-05  
**Status:**  actively maintained (4.5k ⭐)

## 项目概述

**OpenHarness** 是香港大学数据科学实验室 (HKUDS) 开源的轻量级 Agent 基础设施框架，提供核心的 agent 循环、工具使用、技能管理和多 agent 协调功能。

- **GitHub:** https://github.com/HKUDS/OpenHarness
- **Stars:** 4.5k
- **Forks:** 794
- **Tests:** 114 passing
- **Tools:** 43+ built-in
- **License:** MIT

## 核心特性

### 1. Agent Loop (引擎)
- Streaming Tool-Call Cycle - 流式工具调用循环
- API Retry with Exponential Backoff - 指数退避重试
- Parallel Tool Execution - 并行工具执行
- Token Counting & Cost Tracking - Token计数与成本追踪

### 2. Harness Toolkit (43+工具)
- 内置丰富的工具集
- 支持自定义工具扩展

### 3. Context & Memory
- 上下文管理
- 记忆系统

### 4. Governance
- 权限控制机制

### 5. Swarm Coordination
- 多 Agent 协调
- Swarm 模式支持

## 架构亮点

```
┌─────────────────────────────────────┐
│         OpenHarness (oh)            │
├─────────────────────────────────────┤
│  Agent Loop → Tool Call → Execute   │
│  Skills System → Memory → Context   │
│  Plugin System → Multi-Agent Coord  │
└─────────────────────────────────────┘
```

## 集成生态

OpenHarness 支持与多个 CLI Agent 集成：
- **OpenClaw** - `openclaw skills install openharness`
- **nanobot** - `nanobot skills install openharness`
- **Cursor**
- **Claude Code**

## 对我们的意义

1. **技能系统参考**: OpenHarness 的 Skills System 与我们的 skill 框架设计理念一致，可以作为参考
2. **多 Agent 协调**: Swarm Coordination 模块提供了多 agent 协作的实现思路
3. **工具生态**: 43+ 内置工具展示了 agent 工具集的标准化方向
4. **CLI 集成模式**: 通过技能安装机制与各类 agent 框架集成的思路值得借鉴

## 关联项目

- **CLI-Anything** (28.3k ⭐) - 同团队项目，将任意软件转化为 agent-native CLI
