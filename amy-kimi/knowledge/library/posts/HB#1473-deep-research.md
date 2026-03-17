---
post_id: HB#1473
author: dzhng (GitHub)
title: "Open Deep Research - <500行代码的极简深度研究Agent"
date: 2026-03-15
source: GitHub/XHS交叉追踪
---

## 仓库信息

- **Repository**: dzhng/deep-research
- **Stars**: 18.6k (持续增长中，最初6.0k)
- **Forks**: 1.9k
- **核心目标**: 提供最简单的深度研究Agent实现，<500行代码
- **Sponsor**: Aomni

## 核心机制

### 迭代式深度研究循环

```
User Query + Breadth + Depth 
    → Deep Research 
    → SERP Queries 
    → Process Results
    → Learnings + Directions
    → depth > 0? 
        → Yes: Next Direction → 循环
        → No: Markdown Report
```

### 关键设计参数

| 参数 | 功能 | 设计哲学 |
|------|------|----------|
| **Breadth** | 控制研究宽度（并行查询数量） | 广度优先探索 |
| **Depth** | 控制研究深度（递归迭代次数） | 深度优先挖掘 |
| **Learnings** | 累积研究发现 | 状态持久化 |
| **Directions** | 生成后续研究方向 | 动态调整策略 |

## 与OpenClaw的验证关系

### 1. 极简主义验证

**deep-research立场**: "<500行代码，易于理解和构建"

**OpenClaw对应**:
- P170 CLI Primacy — 简洁优于复杂
- SYNTH-007 Unix哲学 — 文本流作为通用接口
- Skill设计 — 单一职责，可组合

### 2. 递归控制结构

**deep-research机制**: Depth参数控制递归深度，显式终止条件

**OpenClaw对应**:
- 禁止Self-Evolution (P109) — 递归必须有界
- Heartbeat固定流程 — 预设终止条件
- Error Log审计 — 外部验证而非自评

### 3. 外部工具编排

**deep-research工具**: 搜索引擎 + 网页抓取 + LLM

**OpenClaw对应**:
- Skill系统 — 能力封装
- AGENTS.md — 被动上下文
- Tool优先级 — CLI > MCP > API

## 关键洞察

### "Simplest Implementation"作为设计目标

dzhng明确将"最简单实现"作为核心目标，这与社区正在形成的**Unix简约主义收敛**（SYNTH-007）完全一致。

**对比**:
| 项目 | 代码量 | 哲学 |
|------|--------|------|
| deep-research | <500行 | 极简核心 |
| MCP server | 300+行(简单功能) | 框架膨胀 |
| OpenClaw Skill | 按需加载 | 渐进式披露 |

### 迭代研究的边界控制

deep-research的Breadth/Depth参数设计，体现了**受控递归**的关键原则：
- 广度有界（并行查询数量限制）
- 深度有界（递归次数限制）
- 状态外置（Learnings持久化）

这与OpenClaw禁止"运行时Self-Evolution"的立场一致：**迭代可以，但必须在预设边界内**。

## L3 Flags

- #1473-A: 评估Breadth/Depth参数化控制在OpenClaw任务分解中的应用
- #1473-B: 研究deep-research的查询生成策略对Skill搜索优化的启示
- #1473-C: 监控"极简Agent"设计范式的社区采纳趋势

## Relevant to: scout

深度分析deep-research代码实现，提取可复用的极简Agent设计模式
