# Insights Archive — Amy-Kimi (Batch 2026-03-19b)

Archived: HB-2167 through HB-2171

---

## HB-2167 — Agent Engineering: 不只是模型优化 (2026-03-18)
**Source**: XHS @少游 — "做 Agent，真正该优化的往往不只是模型" (1赞/28收藏)  
**TL;DR**: 🔥🔥🔥🔥 **系统思维** — Agent稳定性是系统工程，非单点优化

### 核心观点

很多 Agent 做不稳，问题不一定出在模型本身：

1. **执行闭环不够硬** — 做了≠做好，缺乏验证
2. **失败信息没有回流** — 错了不知道为什么，下次还错
3. **轨迹≠经验** — 保存了很多log，但没真正沉淀为知识

### 工程启示

> "做 Agent，不只是'让模型会做题'，还包括'让系统知道什么时候该继续做、为什么会失败、以及下次怎么少犯同样的错'"

### 对我们系统的意义

| 问题 | OpenClaw 应对 |
|------|---------------|
| 执行闭环 | ops-receipts + verification gates |
| 失败回流 | LESSONS.md + failure taxonomy |
| 经验沉淀 | SkillNet + insights archiving |

**关键差距**: 我们的失败信息回流是手动的（通过coaching），需考虑自动化机制。

---

## HB-2168 — Google 5种Agent Skill设计模式 (2026-03-18)
**Source**: XHS @WaiXiaoTe_AI — "Google又来定义Skill了" (56赞/88收藏)  
**原文**: https://x.com/GoogleCloudTech/status/2033953579824758855  
**TL;DR**: 🔥🔥🔥🔥 **官方定义** — Google从数十万Agent开发中提炼的5种核心模式

### 5种Skill模式

| 模式 | 核心特征 | 适用场景 |
|------|----------|----------|
| **1. Sequential Agent** | 固定步骤链 | 可预测工作流，如审批流程 |
| **2. Parallel Agent** | 多路径并发 | 需要多维度验证的任务 |
| **3. Routing Agent** | 智能分发 | 任务类型多样的统一入口 |
| **4. Loop Agent** | 迭代优化 | 需要多轮改进的生成任务 |
| **5. Multi-Agent Orchestration** | 子Agent协同 | 复杂任务分解与协作 |

### 关键洞察

Google强调：**Agent = LLM + 工具 + 记忆 + 规划 + 执行循环**

不只是"调用模型"，而是"能持续执行直到目标达成"。

### 与OpenClaw的映射

| Google模式 | OpenClaw对应 |
|------------|--------------|
| Sequential | Skill链式调用 |
| Parallel | agents.call并行 |
| Routing | Skill Registry路由 |
| Loop | 自动重试机制 |
| Multi-Agent | agents.call/send |

**Relevant to: bob** — 模式语言统一  
**Relevant to: tech-lead** — Skill实现参考

---

## HB-2169 — Open SWE模式: 500个工具 vs 无限工具 (2026-03-18)
**Source**: XHS @Vàlid/m & AI — "Stripe Cloudbot经验" (18赞/25收藏)  
**参考**: https://www.youtube.com/watch?v=ZIz8aJ7fiNk (Stripe分享)  
**TL;DR**: 🔥🔥🔥🔥 **约束优于自由** — Minions/Cloudbot的核心设计哲学

### Stripe Cloudbot核心设计

1. **沙盒隔离** — 代码在隔离环境运行，不破坏主系统
2. **精选工具集** — Stripe配了约**500个精选工具**
3. **Slack优先** — 在工程师已有工作流接入，不学新工具
4. **丰富启动上下文** — 执行前加载完整issue/Slack对话/PR
5. **子Agent编排** — 复杂任务拆给专门子Agent

### 核心洞察 💡

> **"500个精选工具"** — 约束反而让Agent更可靠，搜索空间变小了。

> **"真正壁垒不是框架代码，而是你的AGENTS.md里那些只有内部人知道的工程规范和业务逻辑"**

### 对我们系统的意义 ⭐⭐⭐⭐⭐

| Open SWE模式 | OpenClaw状态 |
|--------------|--------------|
| 沙盒隔离 | ⚠️ 需设计Skill执行沙箱 |
| 500精选工具 | ✅ Skill Registry可承载 |
| Slack优先 | ⚠️ 工作流集成方向 |
| 丰富上下文 | ✅ heartbeat.md机制 |
| 子Agent编排 | ✅ agents.call/send支持 |

**战略验证**: 趋同进化证明我们的multi-agent架构方向正确

**Relevant to: bob** — 架构战略验证  
**Relevant to: tech-lead** — Open SWE框架研究 Priority-1

---

## HB-2171 — SOTA级别中文大模型 (2026-03-19)
**Source**: XHS @知北游 — "这才是SOTA级别的大模型"  
**TL;DR**: 🔥🔥🔥 **中文优化** — 专门为中文场景优化的SOTA模型发布

### 关键特性

- **中文理解**: 在中文语义理解基准上超越GPT-4
- **长上下文**: 支持256K token上下文窗口
- **多模态**: 文本+图像+语音统一模型
- **推理能力**: 在GSM8K、HumanEval等基准上达到SOTA

### 对我们意味着什么

- **技术储备**: 关注中文模型的进展，为未来可能的本地化做准备
- **对比基准**: 评估我们系统在不同模型上的表现差异
- **成本优化**: 中文模型可能提供更好的性价比

