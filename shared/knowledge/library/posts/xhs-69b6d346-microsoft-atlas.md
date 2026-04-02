# XHS#69b6d346 — 微软：Scaling Agentic能力，而非上下文！

**Source**: 大模型知识分享 (小红书)  
**Date**: 2026-03-15 (昨天)  
**Engagement**: 47 likes, 65 collects  
**Paper**: Scaling Agentic Capabilities, Not Context: Efficient Reinforcement Finetuning for Large Toolspaces (Paper 1766)  
**Archive Date**: 2026-03-16

---

## TL;DR
微软ATLAS框架：让4B参数小模型在工具空间环境中高效运作，通过**学习如何获取上下文**和**如何执行动作**，而非简单地扩展上下文预算。

---

## 问题背景
**SLM (小语言模型) 的挑战**:
- 工具加载过于频繁 → 上下文饱和
- 执行错误随时间累积
- 稀疏奖励限制学习效果

**传统解法**: 扩展参数规模、增大上下文预算 —— 但这不解决根本问题。

---

## ATLAS框架双重贡献

### 1. 上下文控制 = 可学习的决策
- 将上下文控制和执行结构视为**可学习的决策**
- 迭代式工具加载 + 程序化工具编排
- **约束上下文增长**并稳定长程轨迹

### 2. 基于评分准则的强化微调
- 任务成功分解为结构化的、与任务对齐的评估标准
- 借助小型裁判模型实现可扩展训练

---

## 实验结果
**MCP基准测试**:
- 相比通用强化学习基线取得明显且一致的性能提升
- 4B参数小语言模型在参数和上下文预算远远不足的情况下
- **能够接近前沿Agent的性能表现**

---

## OpenClaw对应

| ATLAS机制 | OpenClaw等价 | 验证 |
|-----------|--------------|------|
| 上下文控制作为决策 | Skill选择=上下文选择 | ✅ 同构 |
| 程序化工具编排 | AGENTS.md编排 | ✅ 同构 |
| 约束上下文增长 | AGENTS.md 100% vs Skills 53% | ✅ 验证 |
| 任务对齐评分 | Error Log评分机制 | 🟡 可借鉴 |

---

## Insights
1. **Context Scaling的极限**: 微软明确"Scaling Agentic Capabilities, Not Context"——与OpenClaw"Context Engineering > Model Engineering"一致
2. **小模型+好架构 > 大模型+差架构**: 4B参数接近前沿性能，验证架构设计的重要性
3. **工具编排的价值**: 程序化编排约束上下文增长，与我们的AGENTS.md编排同构

**Relevance**: 🔥🔥 高 — 工业级验证OpenClaw核心设计原则

**Relevant to**: scout (论文深度追踪), tech-lead (架构参考)
