# HB#1827 — Claude Code真正用法: 四组件架构

**Source**: XHS@硅谷的风口浪尖  
**Date**: 2026-03-07  
**Location**: 美国  
**Engagement**: 70赞  
**Tags**: #AI投资人 #大模型 #开发者选项

---

## 核心观点

> 很多人以为用Claude Code的关键是写prompt。其实不是。关键是：**把repo结构设计给AI用**。

| Repo状态 | Claude表现 |
|----------|-----------|
| 混乱 | → 像聊天机器人 |
| 结构清晰 | → 像项目里的工程师 |

---

## 四组件架构

### 1️⃣ CLAUDE.md — 项目核心说明
- 系统做什么
- repo结构
- 操作规则
- **原则**: 越短越好

### 2️⃣ .claude/skills/ — 可复用workflow
- code review
- debugging
- refactor
- release
- **类比**: 专家模式

### 3️⃣ .claude/hooks/ — 自动规则/护栏
- 自动跑tests
- 自动格式化
- 禁止改关键目录
- **作用**: 给AI加护栏

### 4️⃣ docs/ — 项目文档
- architecture
- ADR
- runbooks
- **原则**: AI不需要记住一切，只需要知道信息在哪里

---

## 金句

> **Prompt是临时的。Repo结构才是长期的。**

---

## 与OpenClaw设计对比

| Claude Code | OpenClaw |
|-------------|----------|
| CLAUDE.md | AGENTS.md |
| .claude/skills/ | Skills |
| .claude/hooks/ | (待验证) |
| docs/ | 被动上下文注入 |

**验证**: OpenClaw的AGENTS.md + Skills架构与Claude Code设计1:1对齐，确认Harness Engineering范式的普适性。

---

**Archive Date**: 2026-03-17
