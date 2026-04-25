# Anthropic: Building Effective Agents — 工程实践指南

**来源**: Anthropic Engineering Blog  
**发布时间**: 2024年12月19日  
**标签**: `agent-patterns`, `workflows`, `best-practices`, `anthropic`  
**发现者**: Amy-Kimi Heartbeat  
**发现时间**: 2025-04-25

---

## 核心论点

> "The most successful implementations weren't using complex frameworks or specialized libraries. Instead, they were building with simple, composable patterns."

Anthropic 与数十个跨行业团队合作的总结:**简单的、可组合的模式 > 复杂的框架**。

---

## 关键区分: Workflows vs Agents

| 维度 | Workflows (工作流) | Agents (智能体) |
|------|-------------------|-----------------|
| **控制方式** | 预定义代码路径编排 | LLM 动态指导自身进程 |
| **灵活性** | 低 — 适合明确定义的任务 | 高 — 适合需要模型决策的场景 |
| **可预测性** | 高 | 低 |
| **延迟/成本** | 通常更低 | 通常更高 |

**关键洞察**: 不要一上来就构建 Agents。从最简单的方案开始，只在需要时增加复杂度。

---

## 五大生产级模式

### 1. Prompt Chaining (提示链)
```
输入 → LLM Call 1 → 检查点 → LLM Call 2 → 检查点 → 输出
```
- **适用**: 可清晰分解为固定子任务的场景
- **优势**: 用延迟换取准确性，每个 LLM Call 任务更简单
- **例子**: 生成营销文案 → 翻译成其他语言

**OpenClaw 对应**: 我们的 multi-step workflow / project 模式

### 2. Routing (路由)
```
输入 → 分类器 → [分支A] 或 [分支B] 或 [分支C]
```
- **适用**: 有明显类别区分，分别处理效果更好
- **优势**: 关注点分离，可为每个类别优化专用 Prompt
- **例子**: 客服查询按类型(一般问题/退款/技术支持)路由

**OpenClaw 对应**: 我们的 agent.dispatch() / workflow selection

### 3. Parallelization (并行化)
#### Sectioning (分段)
```
输入 → [子任务A] + [子任务B] + [子任务C] → 聚合结果
```

#### Voting (投票)
```
输入 → [LLM Call 1] + [LLM Call 2] + [LLM Call 3] → 多数表决
```

- **适用**: 需要多角度验证或覆盖广度优先于深度
- **优势**: 聚焦单个方面时 LLM 表现更好
- **例子**: 代码安全审查 — 多个 Prompt 分别检查不同漏洞类型

**OpenClaw 对应**: Scout 的多源调研、多个 evaluator 投票

### 4. Orchestrator-Workers (协调器-工作者)
```
输入 → 协调器 (动态分解任务)
    ├─ 委派给 Worker A
    ├─ 委派给 Worker B
    └─ 委派给 Worker C
    ← 汇总结果
```
- **适用**: 无法预测需要哪些子任务的复杂场景
- **vs Parallelization**: 子任务不是预定义的，由协调器动态决定
- **例子**: 代码修改涉及多个文件、复杂搜索任务

**OpenClaw 对应**: 尚未完全实现 — 我们的 task decomposition 是隐式的

### 5. Evaluator-Optimizer (评估器-优化器)
```
生成器 → 输出 → 评估器 (反馈)
    ↑___________________|
           (循环迭代)
```
- **适用**: 有明确评估标准，迭代改进可度量价值
- **判断标准**: 
  1. 人类反馈能 demonstrably 改进 LLM 输出
  2. LLM 能提供此类反馈
- **例子**: 文学翻译的润色、复杂搜索的逐步精炼

**OpenClaw 对应**: Coach/Evaluator 的评估循环、Error Log 学习

---

## 框架使用建议

### 推荐的框架
- **Claude Agent SDK** — Claude Code 衍生，配置优先
- **Strands Agents SDK** — AWS 出品
- **Rivet** — 拖拽式 GUI Workflow 构建器
- **Vellum** — 复杂 Workflow 构建和测试

### ⚠️ 关键警告
> "These frameworks often create extra layers of abstraction that can obscure the underlying prompts and responses, making them harder to debug."

**建议**: 
1. **先用 LLM API 直接实现** — 很多模式只需几行代码
2. **如果使用框架，确保理解底层代码** — 错误假设是客户错误的主要来源
3. **避免不必要的复杂度** — 简单设置足够时，不要引入框架

---

## 对 OpenClaw 的验证与启示

### ✅ 我们的设计符合 Anthropic 推荐

| Anthropic 推荐 | OpenClaw 实现 | 符合度 |
|---------------|---------------|--------|
| 从简单开始 | 直接 LLM API，无重框架 | ✅ |
| Workflows 优先 | Project workflow 系统 | ✅ |
| Routing 模式 | Agent.dispatch() | ✅ |
| Evaluator-Optimizer | Coach/Evaluator + Error Log | ✅ |
| 文件系统协调 | Markdown-based 知识库 | ✅ |

### ⚠️ 可改进的方向

1. **更明确的 Orchestrator-Workers**
   - 目前: 隐式任务分解
   - 改进: 显式规划 Agent 动态委派

2. **更系统的 Parallelization**
   - 目前: Scout 多源调研是手动的
   - 改进: 自动并行 + 智能聚合

3. **Prompt Chaining 形式化**
   - 目前: Project milestones 隐含
   - 改进: 显式 chain with gates

4. **考虑 Claude Agent SDK**
   - 评估: 是否与我们的文件系统哲学兼容？

---

## 社区关键洞察

来自小红书原帖讨论 (无影寺 69288680):

> "也许可以生成面向 agent 的开发日志，把给人看的 high level 和给 coding agent 看的版本区分开来"

**我们的实现**: 
- 人类可读: `SIGNALS.md`, `bulletin.md`
- Agent 优化: `insights.md`, `knowledge-essentials.md`

这与 Anthropic 的 "claude-progress.txt" 跨会话记忆桥类似。

---

## 关键引用

> "When building applications with LLMs, we recommend finding the simplest solution possible, and only increasing complexity when needed."

> "Agentic systems often trade latency and cost for better task performance, and you should consider when this tradeoff makes sense."

> "Many patterns can be implemented in a few lines of code."

---

## 相关阅读

- [HB-0040: DeerFlow](HB-0040-deerflow-bytedance-super-agent.md) — 复杂框架的代表
- [HB-0041: Governed Memory](HB-0041-governed-memory-production.md) — 生产级记忆架构
- 原文: https://www.anthropic.com/engineering/building-effective-agents

---

## 总结

Anthropic 的文章是 **Agent 工程化的宣言**:
1. **模式 > 框架** — 理解底层模式比使用框架更重要
2. **渐进复杂度** — 从简单开始，按需增加
3. **五种核心模式** — Chaining, Routing, Parallelization, Orchestrator-Workers, Evaluator-Optimizer

**OpenClaw 的评估**: 我们的"无框架、文件系统、Workflow 优先"架构与 Anthropic 推荐高度一致。需要加强的是**显式规划层** (Orchestrator-Workers) 和**更系统的并行化**。
