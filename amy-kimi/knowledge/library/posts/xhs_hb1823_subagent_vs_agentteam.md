# HB#1823: SubAgent vs AgentTeam——多智能体实现对比复盘

**Source**: XHS@老朱说AI  
**URL**: https://www.xiaohongshu.com/explore/69ad9164000000001a01dab6  
**Date**: 2026-03-08  
**Likes**: 120 | **Collects**: 206  
**Importance**: 🔥🔥🔥🔥  
**Tags**: #subagent #agent_team #multi_agent #architecture #mcp

---

## 实战背景

作者在本地 AI 桌面应用中同时实现了两套多智能体方案，踩坑后分享心得。

---

## Sub Agent（子代理）

| 特性 | 说明 |
|-----|------|
| 运行方式 | 进程内运行 |
| 启动速度 | 毫秒级 |
| 生命周期 | Map 管理 |
| 通信方式 | EventEmitter 投递结果 |
| 适用场景 | 简单后台任务 |
| **局限** | 子代理之间无法通信 |

---

## Agent Team（智能体团队）

| 特性 | 说明 |
|-----|------|
| 运行方式 | 基于 SDK，独立进程 |
| 通信方式 | mailbox 通信 |
| 团队结构 | AI 自主决定 |
| 任务分配 | AI 自主分配 |
| 结果汇总 | AI 自主汇总 |
| 适用场景 | 复杂研究和分析任务 |
| **代价** | token 消耗较多 |

---

## 核心架构亮点

### 双引擎设计
- 用 `/team` 命令切换执行引擎
- 两套系统通过**适配层**共享 Provider 配置和记忆系统

### 技术难题解决
1. **SDK stream 生命周期管理** —— resume 循环 + 空闲检测
2. **ESM/CJS 混合加载** —— 模块系统兼容性

---

## 行业趋势预测

| 时间 | 趋势 |
|-----|------|
| 2025 | MCP 协议成为标准 |
| 2025 | 多智能体框架百花齐放（CrewAI、AutoGen、LangGraph 等） |
| 2026 | 预计出现**自组织 Agent 团队** |
| 2026 | 跨平台协作成为常态 |

---

## 关键评论摘录

> **Derekole**: "agent team 这一段，一个采数据一个做研究一个写报告，逻辑上没办法并行吧，这都是有上下游关系的串行任务啊"

> **老朱说AI 回复**: "一个 researcher 搜集裁员数据，一个 analyst 分析股价变化，一个 reporter 生成 HTML 报告。这几个角色 somehow 是可以并行的，最绝的是通过监控过程日志，确实看到 teammate 之间是有消息互通的，真的就像一个 team 在协作一样。和 subagent 完全不一样，但是 token 确实也耗费比较多……"

---

## 与 OpenClaw 的对齐验证

| 作者实践 | OpenClaw 设计 | 验证 |
|---------|--------------|------|
| Sub Agent 轻量快速 | Main Agent ↔ Sub-agent 架构 | ✅ 一致 |
| Agent Team 重量级协作 | 复杂任务多 Agent 协作 | ⚠️ Gap |
| 适配层共享配置 | Session State 统一存储 | ✅ 一致 |
| AI 自主决定团队结构 | L3 Flags #5 决策规则待完善 | 📝 需补充 |

---

## 洞察

**工程实践验证**：SubAgent 适合轻量任务，AgentTeam 适合复杂协作——但代价是显著的 token 开销。

这与我们之前发现的 "错误放大效应" 和 "Centralized Topology" 洞察一致：**不是 Agent 越多越好，而是协作结构决定效率**。

**关键设计启示**：
1. 提供双引擎（轻量/重量级）让用户根据任务选择
2. 并行任务用 AgentTeam，串行任务用 SubAgent
3. 适配层是共享基础设施的关键

---

**Archived**: 2026-03-17 by Amy-Kimi
