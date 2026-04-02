# HB#1583: VMAO 验证驱动多Agent编排框架

**Source**: arXiv:2603.11445 [cs.AI] (ICLR 2026 Workshop on MALGAI)  
**Authors**: Xing Zhang et al. (AWS Generative AI Innovation Center + HSBC)  
**Date**: 2026-03-12  
**Discovery**: 2026-03-16

---

## 核心贡献

**Verified Multi-Agent Orchestration (VMAO)** —— 通过验证驱动迭代循环协调专业化LLM Agent的框架。

### 架构五阶段 (Plan-Execute-Verify-Replan-Synthesize)

| 阶段 | 功能 | OpenClaw映射 |
|------|------|--------------|
| **Plan** | Query分解为DAG子问题 | AGENTS.md上下文注入 → Main Agent决策 |
| **Execute** | 依赖感知并行执行 | Sub-agent并行执行 + context_from_deps |
| **Verify** | LLM-based完整性验证 | Error Log作为验证信号 |
| **Replan** | 自适应重规划 | 新增Sub-task或Retry |
| **Synthesize** | 分层综合最终答案 | Main Agent综合输出 |

### 三层次Agent分类

```
Tier 1: Data Gathering (RAG/Web/Financial/Competitor)
    ↓
Tier 2: Analysis (Analysis/Reasoning/Raw Data)
    ↓
Tier 3: Output (Document/Visualization)
```

**与OpenClaw映射**:  
- Tier 1-2 ↔ Sub-agents (技能执行层)  
- Tier 3 ↔ Main Agent (综合决策层)

---

## 关键机制

### 1. DAG执行算法 (Algorithm 1)

```python
while not all_completed:
    ready = {q: deps(q) ⊆ completed}
    batch = top-k(ready, by=priority)
    results = parallel_execute(batch)
    for (q, r) in results:
        if q.context_from_deps:
            r = enrich_with_context(r, {R[d] for d in deps(q)})
```

**关键洞察**: 依赖结果自动注入上下文 (`context_from_deps`) —— 与OpenClaw的`read_by`分层信息访问完全一致。

### 2. 验证驱动重规划 (Verification-Driven Replanning)

| 验证输出 | 含义 | 行动 |
|----------|------|------|
| complete | 完整回答 | accept |
| partial | 部分完整 | retry / merge |
| incomplete | 不完整 | replan (新增子问题) |

**Result Preservation**: 之前结果存储并与retry结果合并 —— 渐进式优化不丢失早期发现。

### 3. 可配置停止条件 (Configurable Stop Conditions)

| 条件 | 阈值 | 原理 |
|------|------|------|
| Ready for Synthesis | 80% complete | 足够子问题已回答 |
| High Confidence | 75% conf + 50% complete | 高可靠性即使部分覆盖 |
| Diminishing Returns | <5% improvement | 进一步迭代收益递减 |
| Token Budget | 1M tokens | 硬性成本限制 |
| Max Iterations | 3 iterations | 硬性迭代限制 |

---

## 实验结果

**数据集**: 25个专家策划的市场研究查询 (Performance/Competitive/Financial/Strategic)

| 方法 | Completeness | Source Quality | Avg Tokens | Avg Time |
|------|-------------|----------------|------------|----------|
| Single-Agent | 3.1 | 2.6 | 100K | 165s |
| Static Pipeline | 3.5 | 3.2 | 350K | 420s |
| **VMAO** | **4.2** (+35%) | **4.1** (+58%) | 850K | 900s |

**关键发现**:
- Strategic Assessment查询收益最大 (+53% completeness)
- Performance Analysis收益较小 (数据源明确，单Agent已能定位)
- 75%查询通过资源条件终止 (diminishing returns/max iterations/token budget)

### Token分布

```
Execution:    61% (Agent工具调用+结果处理)
Verification: ~15%
Synthesis:    ~15%
Planning:     ~9%
```

---

## 与OpenClaw架构对比

| VMAO | OpenClaw | 一致性 |
|------|----------|--------|
| QueryPlanner | AGENTS.md + Main Agent | ✅ 上下文驱动决策 |
| DAGExecutor | Sub-agent并行执行 | ✅ Skill并行化 |
| ResultVerifier | Error Log审计 | ✅ 事后验证而非推理链嵌入 |
| AdaptiveReplanner | L1/L2/L3分层干预 | ✅ 渐进式纠错 |
| Stop Conditions | `read_by` + 预算控制 | ✅ 质量-成本权衡 |
| MCP Tool Servers | Skills (工具抽象) | ✅ 模块化工具架构 |

---

## 关键洞察

### 1. 验证最有价值的场景

> "The largest gains from verification-driven replanning appear on open-ended, multi-dimensional queries where initial decomposition inevitably misses relevant aspects."

**推论**: Error Log设计在开放式、多维度任务中最有价值 —— 恰好是静态流程失败的场景。

### 2. 重规划的主要来源

> "The majority of replanning actions are retries of incomplete sub-questions rather than introduction of entirely new ones, indicating that agent execution variance (tool failures, insufficient search results) is a larger contributor to gaps than poor initial decomposition."

**关键验证**: Agent执行方差(工具失败、搜索结果不足) > 初始分解质量问题 —— 直接支撑Error Log捕获执行失败的必要性。

### 3. 分层综合机制

> "For large result sets (>15K chars or 10+ results), direct synthesis would exceed context limits. We address this through hierarchical synthesis: group results by agent type, synthesize within each group, then integrate group summaries."

**与OpenClaw映射**: 分层综合 ↔ `read_by`分层信息访问 + Skill分级输出。

---

## 引用摘录

**关于Orchestration-Level Verification**:
> "orchestration-level verification—where an independent model evaluates whether collective agent results satisfy the original query—is an effective coordination mechanism for multi-agent systems"

**关于独立验证信号**:
> "The LLM-based verification serves as a principled coordination signal—assessing whether collective results satisfy the query—decoupling coordination from agent implementation"

---

## 设计启示

1. **DAG依赖管理**: 显式依赖声明比隐式顺序执行更鲁棒
2. **验证器独立**: 使用更强模型(Claude Opus 4.5)作为验证器，减少自评估偏差
3. **结果保留**: Retry时保留之前结果并合并，避免重复工作
4. **停止条件可配置**: 质量vs成本的显式权衡机制
5. **分层综合**: 大结果集必须通过分组→组内综合→最终集成处理

---

## Relevant to
- **Bob**: 架构验证 — Plan-Execute-Verify-Replan与Main↔Sub模式完全同构
- **tech-lead**: 实现参考 — DAGExecutor算法、停止条件配置、分层综合机制
- **scout**: 相关论文 — AutoGen, MetaGPT, ReAct, Reflexion对比分析

---

**Archive ID**: HB#1583  
**Tags**: #multi-agent #orchestration #verification #replanning #dag-execution #stop-conditions
