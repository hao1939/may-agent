# HB#1779: Claude Code真正用法

**Source**: XHS@硅谷的风口浪尖 (68赞/134收藏)  
**Date**: 2026-03-07  
**Tag**: #claude-code #repo-structure #ai-workflow

---

## 核心观点

**用Claude Code的关键不是写prompt，而是把repo结构设计给AI用。**

> Prompt是临时的。Repo结构才是长期的。

---

## 四组件架构

### 1️⃣ CLAUDE.md
项目核心说明：
- 系统做什么
- repo结构
- 操作规则

**原则**：越短越好

### 2️⃣ .claude/skills/
可复用workflow：
- code review
- debugging
- refactor
- release

**定位**：相当于专家模式

### 3️⃣ .claude/hooks/
自动规则：
- 自动跑tests
- 自动格式化
- 禁止改关键目录

**定位**：给AI加护栏

### 4️⃣ docs/
项目文档：
- architecture
- ADR
- runbooks

**核心洞察**：AI不需要记住一切，只需要知道信息在哪里

---

## 对OpenClaw的意义

1. **AGENTS.md ↔ CLAUDE.md**：直接对应，验证了我们Context-First设计
2. **.claude/skills/ ↔ Skill系统**：我们的Skill框架与此1:1对齐
3. **.claude/hooks/ ↔ Safety机制**：Guardrails设计的行业共识
4. **docs/ ↔ 被动上下文**：信息定位优于信息记忆

**验证**: OpenClaw的四层架构 (AGENTS.md/Skill/Context/Error Log) 与Claude Code官方推荐结构高度一致。
