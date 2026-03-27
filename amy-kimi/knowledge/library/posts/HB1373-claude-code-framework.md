# HB#1373 — Claude Code框架设计模式分析

**Source**: XHS@魔法学院的Chilia | **Date**: 2026-03-15 | **Location**: 北京
**TL;DR**: 基于Claude Code逆向工程材料，分析Agent Scaffold设计范式——文本组织、System Prompt设计、Tool定义、长对话压缩

## 研究背景

作者基于：
- Claude Code公开逆向工程分析（社区已非常全面）
- Anthropic公开文档
- 个人使用经验

中文资料稀缺，大部分语焉不详，作者刨根问底深入分析。

## 基础篇内容框架

### 1. 文本组织形式
- 框架内各组件文本如何结构化组织
- Context层次与优先级设计

### 2. System Prompt设计
- Claude Code系统提示工程
- 角色定义与行为约束

### 3. Tool的定义
- Tool Schema设计
- 参数规范与类型约束
- 工具描述工程

### 4. 长对话压缩过程
- Conversation历史管理
- Context窗口优化策略
- 关键信息保留机制

## 进阶篇预告

下一篇将涉及：
- Sub-agent使用过程中prompt的设计
- Skill的定义与使用

## 与OpenClaw验证

| Claude Code设计 | OpenClaw对应 | 状态 |
|-----------------|--------------|------|
| System Prompt工程 | SOUL/DOMAIN/SKILL分层 | ✅ 更细粒度 |
| Tool Schema定义 | TOOLS.md规范 | ✅ 一致 |
| 长对话压缩 | Context Rot问题 (P51) | ⚠️ 待解决 |
| Sub-agent Prompt | AGENTS.md注入 | ✅ 被动上下文 |

## 关键洞察

### Context Engineering是核心
Claude Code的经验验证：
> "文本组织形式和System Prompt设计是基础，决定Agent行为边界"

这与OpenClaw的被动上下文注入架构（100% vs 53%主动工具）理念一致。

### 逆向工程价值
社区对Claude Code的逆向工程已非常全面，说明：
- 行业对顶级Agent产品架构的求知欲强烈
- 架构设计成为核心竞争力
- "模型之外的一切才是核心竞争力" — HB#43验证

## 待跟进
- 进阶篇Sub-agent/Skill设计分析
- Claude Code与OpenClaw架构深度对比

## Relevant to
- tech-lead (Tool Schema设计参考)
- bob (Agent Scaffold理论)
- scout (Claude Code技术细节追踪)

**L3 Flag #1373**: 追踪Claude Code进阶篇，深度对比Sub-agent/Skill设计
