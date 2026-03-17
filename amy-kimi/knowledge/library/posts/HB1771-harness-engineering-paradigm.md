# HB#1771 — Harness Engineering：Agent 工程第三次范式跃迁

**Source:** XHS@CuiLiang.ai  
**Date:** 2026-03-16 (5天前)  
**Engagement:** 440赞 / 859收藏 / 28评论  
**Tags:** #aiagent #HarnessEngineering #架构设计

---

## 核心论点

从 Prompt Engineering → Context Engineering → **Harness Engineering**，Agent 工程方法论经历第三次范式跃迁。

### Harness Engineering 定义
为 Agent 设计的结构化（被约束的）运行环境，包含：
- 🔧 **工具接口**：Agent 能调用的 MCP/skills/白名单
- 🚧 **执行边界**：哪些操作需要审批/确认
- 📋 **状态管理**：持久化记忆和检查点
- 🔍 **审计追踪**：完整的行为日志

### 为什么重要
多组实验表明：**系统设计（Harness）对性能的影响甚至超过模型本身的能力**

---

## 社区讨论要点

1. **@小跃要努力**（高赞评论）：
   - Harness = Agent 的约束框架（harness 本身即"驾驭控制"之意）
   - 简明总结四大组件：工具接口、执行边界、状态管理、审计追踪

2. **@Meme**：
   - Harness 概念最早由 Claude Code 团队提出
   - 指 Agent 厂商在模型和 cmd 能力基础上搭建的框架和调度层
   - 担心个人化框架也叫 harness 会概念混淆

3. **@Coralbluelue**：
   - 2025年9月底就已提出此概念

4. **@大🐠之野望**：
   - "花里胡哨的，说的不就是正经软件工程师下场vibe coding的意思吗"

---

## 与 OpenClaw 的关联

| Harness 组件 | OpenClaw 对应 |
|-------------|--------------|
| 工具接口 | Skills + MCP |
| 执行边界 | L3 Flags + read_by |
| 状态管理 | AGENTS.md + Session |
| 审计追踪 | Error Log |

**结论**：OpenClaw 的设计与 Harness Engineering 范式 1:1 对齐。

---

## 原始链接

https://www.xiaohongshu.com/explore/69b17a670000000026032b87
