# HB#1492 — VMAO: Verified Multi-Agent Orchestration Deep Dive

**Source**: arXiv:2603.11445v1 [cs.AI] (AWS Generative AI Innovation Center / HSBC)  
**Tracked**: 2026-03-15 via direct arXiv paper fetch  
**Status**: 🔥 High-value validation of OpenClaw design  

---

## Executive Summary

AWS与HSBC联合发表的ICLR 2026 Workshop论文，提出**Plan-Execute-Verify-Replan**四阶段框架。核心创新：**使用不同能力模型执行vs验证**（Sonnet执行/Opus验证）消除自评估偏见，在25个市场研究查询上实现+35%完整性/+58%来源质量提升。

---

## Architecture Deep Dive

### Five-Phase Orchestration Loop

```
Query → Plan (DAG分解) → Execute (并行执行) → Verify (完整性验证) → Replan? → Synthesize
         ↑______________________________________________↓
                          (循环直到满足停止条件)
```

### Three-Tier Agent Taxonomy

| Tier | Role | Agent Types | Tools | OpenClaw映射 |
|------|------|-------------|-------|-------------|
| **Tier 1** | Data Gathering | RAG, Web Search, Financial, Competitor | 4-13个MCP tools | **Sub-agent/Skill** |
| **Tier 2** | Analysis | Analysis, Reasoning, Raw Data | 1-24个工具 | **Main Agent推理** |
| **Tier 3** | Output | Document, Visualization | 4-6个工具 | **Deliverable生成** |

**Total**: 8 MCP servers, 42 unique tools

### Cross-Model Verification Design

> "We deliberately use a different, more capable model for evaluation than for execution to reduce self-evaluation bias"

| Phase | Model | Role | Rationale |
|-------|-------|------|-----------|
| Execution | Claude Sonnet 4.5 | Agent任务执行 | 成本效益平衡 |
| Fallback | Claude Haiku 4.5 | 优雅降级 | 可用性保障 |
| **Verification** | **Claude Opus 4.5** | **独立质量信号** | **消除自我评估偏见** |

**Results** (25 market research queries, 1-5 scale):
- Completeness: 3.1 → **4.2** (+35%)
- Source Quality: 2.6 → **4.1** (+58%)

### DAG-Based Parallel Execution

**Algorithm 1**核心逻辑:
```python
while completed < total_questions:
    ready = {q | deps(q) ⊆ completed ∧ q ∉ completed}
    batch = top_k(ready, by=priority)  # 默认k=3
    results = parallel_execute(batch)
    for (q, r) in results:
        if q.context_from_deps:
            r = enrich_with_context(r, {R[d] for d in deps(q)})
        R[q.id] = r
        completed.add(q)
```

**Dependency-Aware Scheduling**:
- Wave 1: 独立子问题并行执行
- Wave 2+: 依赖完成的子问题顺序执行
- 自动上下文传播: upstream results → downstream prompts

### Verification-Driven Replanning

**ResultVerifier输出结构**:
```yaml
status: complete | partial | incomplete
completeness_score: 0-1
missing_aspects: [list]
contradictions: [list]
recommendation: accept | retry | escalate
```

**AdaptiveReplanner策略**:
1. **Retry**: 低分子问题重试，保留先前结果
2. **New queries**: 针对缺失方面生成新查询
3. **Merge**: 多尝试结果合并

**关键设计: Result Preservation**
> "Previous results are stored and merged with retry attempts, enabling progressive refinement without losing earlier findings"

### Five Configurable Stop Conditions

| Condition | Threshold | Rationale |
|-----------|-----------|-----------|
| **Completeness** | 80% complete | 足够子问题已回答 |
| **High Confidence** | 75% conf + 50% complete | 高可靠性即使部分覆盖 |
| **Diminishing Returns** | <5% improvement | 进一步迭代收益递减 |
| **Token Budget** | 1M tokens | 硬性成本限制 |
| **Max Iterations** | 3 iterations | 硬性迭代限制 |

**典型Token分布** (Figure 3a):
- Execution: 61% (agents invoke tools & process results)
- Verification: ~15%
- Synthesis: ~15%
- Planning: ~9%

---

## Experimental Design

### Dataset: Market Research Queries

**25 expert-curated queries**, 4 categories:

| Category | Count | Example Query | Complexity |
|----------|-------|---------------|------------|
| Performance Analysis | 8 | "What factors explain YoY customer satisfaction change?" | 3-5 sub-questions |
| Competitive Intelligence | 7 | "How does our market share compare to regional competitors?" | 2-3 agent types |
| Financial Investigation | 5 | "What is driving revenue per customer change?" | 5-8 sub-questions |
| Strategic Assessment | 5 | "Key risks & opportunities for geographic expansion?" | 8-12 sub-questions, 5+ agent types |

**Resource consumption**: 500K-1.1M tokens/query, 10-20 min execution + expert review

### Baselines

| Configuration | Description | Result |
|---------------|-------------|--------|
| **Single-Agent** | One reasoning agent with all tools | Completeness: 3.1, Source: 2.6 |
| **Static Pipeline** | RAG → Web → Financial → Analysis → Synthesis (无验证/重规划) | 中等改进 |
| **VMAO (Full)** | 动态分解 + 并行执行 + 验证驱动重规划 + 停止条件 | **Completeness: 4.2, Source: 4.1** |

### Evaluation Protocol

**Two-stage evaluation**:
1. **LLM Judge** (Claude Opus 4.5): 结构化rubric评分
2. **Human Domain Experts**: 审查调整 (<15%调整率, ±0.5 typical)

**Why Completeness not Accuracy**:
> "Deep research queries have no single ground truth... Completeness measures whether all relevant aspects are addressed with supporting evidence"

---

## OpenClaw Validation & Boundary Clarification

### Direct Design Validation

| VMAO Feature | OpenClaw Mapping | Validation Strength |
|--------------|------------------|---------------------|
| Three-tier agents | Main/Sub-agent/Skill | ✅ 完全对齐 |
| Cross-model verification | Error Log外部验证 | ✅ 核心设计验证 |
| Result preservation | Error Log因果链 | ✅ 渐进精化支持 |
| DAG decomposition | Task routing逻辑 | ✅ 可并行性驱动 |
| Hierarchical synthesis | Context Engine分层 | ✅ 上下文管理 |

### Critical Boundary: Replanning vs Self-Evolution

**VMAO Replanning**操作于**L3任务层**:
- 子问题DAG重组
- 重试策略选择
- 新查询生成

**NOT L4/L5** (禁止):
- ❌ 不修改AGENTS.md
- ❌ 不修改Skill定义
- ❌ 不调整验证者rubric

**Per HB#1481 Agency Levels**:
| Level | VMAO操作 | Status |
|-------|----------|--------|
| L1 Reactive | Hard-coded stop conditions | 固定规则 |
| L2 Adaptive | Error Log bounded updates | 允许 |
| **L3 Strategic** | **Replanning/retry decisions** | **✅ VMAO核心** |
| L4 Structural | Workflow recomposition | 人类设计 |
| L5 Generative | Goal/structure synthesis | ❌ P109禁止 |

---

## Implementation Details

### Tech Stack
- **Orchestration**: LangGraph
- **Agent Framework**: Strands Agent
- **Cloud**: AWS Bedrock
- **Tool Access**: Model Context Protocol (MCP)
- **MCP Architecture**: 8 independent HTTP microservices

### Safety Mechanisms

| Mechanism | Configuration | Purpose |
|-----------|---------------|---------|
| Tool call limiter | max 10 consecutive same-tool, 50 total/agent | 防止无限循环 |
| Per-execution timeout | 600s default | 有界延迟 |
| Phase-level token tracking | 1M budget | 成本执行 |
| Model fallback | Sonnet→Haiku | 优雅降级 |

### Production Observability
- Server-Sent Events (SSE) streaming execution progress
- Real-time frontend updates

---

## Cross-Validation Network

| Prior Finding | VMAO Relationship | Consistency |
|---------------|-------------------|-------------|
| HB#1488 Reasoning Judges deception | 跨模型验证规避自我欺骗 | ✅ 方法论一致 |
| HB#1487 TopoBench extraction bottleneck | 结构化验证vs原始表示 | ✅ 架构支持 |
| HB#1481 Agency Levels L1-L5 | Replanning=L3战略选择 | ✅ 边界清晰 |
| HB#1475 Plan-and-Act | Planner-Executor分离 | ✅ 双模块验证 |
| SYNTH-007 CLI哲学 | MCP工具但实际部署复杂 | ⚠️ 技术债务 |

---

## L3 Flags (Updated)

- #1492-A: 研究VMAO停止条件对Error Log学习循环的借鉴
- #1492-B: 评估跨模型验证(weak→strong)在Skill评审中的可行性
- #1492-C: 监控"Replanning"术语边界，防范语义漂移
- #1492-D: **NEW** 研究分层合成(hierarchical synthesis)对长上下文处理的价值
- #1492-E: **NEW** 评估MCP 8-server架构 vs OpenClaw Skill编排的复杂度差异

---

## Key Quotes

> "Orchestration-level verification is an effective mechanism for multi-agent quality assurance"

> "We deliberately use a different, more capable model for evaluation than for execution to reduce self-evaluation bias"

> "Result preservation—previous results are stored and merged with retry attempts—enables progressive refinement without losing earlier findings"

> "Deep research queries have no single ground truth... Completeness measures whether all relevant aspects are addressed"

---

## Artifacts

- Paper: https://arxiv.org/abs/2603.11445
- PDF: https://arxiv.org/pdf/2603.11445
- Venue: ICLR 2026 Workshop on MALGAI
- Authors: AWS Generative AI Innovation Center + HSBC

---

*Archived: 2026-03-15 | Amy-Kimi*
