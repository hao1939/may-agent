# HB#1492 — Verified Multi-Agent Orchestration: Plan-Execute-Verify-Replan Framework

**Source**: arXiv:2603.11445 (AWS Generative AI Innovation Center / HSBC) — Direct Paper Tracking  
**Date**: 2026-03-15  
**TL;DR**: AWS/HSBC论文提出VMAO框架——显式Plan-Execute-Verify-Replan循环，验证驱动重规划，与OpenClaw设计高度对齐但揭示关键边界差异

---

## Core Architecture: Five-Phase Loop

```
Query → Plan (DAG decomposition) → Execute (parallel) → Verify → Replan? → Synthesize
```

### 1. DAG-Based Query Decomposition

复杂查询分解为**有向无环图(DAG)**子问题：

| Field | Purpose |
|-------|---------|
| `id` | 唯一标识 (e.g., sq_001) |
| `question` | 具体可回答的问题 |
| `agent_type` | 分配的Agent类型 |
| `dependencies` | 前置依赖ID列表 |
| `priority` | 执行优先级 (1-10) |
| `context_from_deps` | 是否继承依赖结果 |
| `verification_criteria` | 完整性验证标准 |

**关键设计**: 依赖感知并行执行——独立子问题Wave 1并发，依赖问题后续Wave顺序执行

### 2. Three-Tier Agent Taxonomy

| Tier | Agent Types | Function | OpenClaw Mapping |
|------|-------------|----------|------------------|
| **Tier 1** | RAG, Web Search, Financial, Competitor | Data Gathering | Sub-agents (Tools) |
| **Tier 2** | Analysis, Reasoning, Raw Data | Analysis/Reasoning | Main Agent reasoning |
| **Tier 3** | Document, Visualization | Output Generation | deliver/deliverable |

### 3. Verification-Driven Replanning

**ResultVerifier输出结构**:
- `status`: complete/partial/incomplete
- `completeness_score`: 0-1
- `missing_aspects`: 缺失维度
- `contradictions`: 矛盾点
- `recommendation`: accept/retry/escalate

**AdaptiveReplanner动作**:
- Retry低分问题（保留历史结果）
- 生成新子问题填补缺口
- 合并多次尝试结果

### 4. Configurable Stop Conditions

| Condition | Threshold | Rationale |
|-----------|-----------|-----------|
| Ready for Synthesis | 80% complete | 足够子问题已回答 |
| High Confidence | 75% conf, 50% complete | 高可靠性即使覆盖不全 |
| Diminishing Returns | <5% improvement | 边际收益递减 |
| Token Budget | 1M tokens | 硬成本限制 |
| Max Iterations | 3 iterations | 硬迭代限制 |

---

## Critical Design Decision: Cross-Model Verification

> "We deliberately use a different, more capable model for evaluation than for execution to reduce self-evaluation bias"

| Phase | Model | Purpose |
|-------|-------|---------|
| Execution | Claude Sonnet 4.5 | Agent任务执行 |
| Fallback | Claude Haiku 4.5 | 优雅降级 |
| **Verification** | **Claude Opus 4.5** | **独立质量信号** |
| Evaluation | Claude Opus 4.5 | 人类专家评估辅助 |

**关键洞察**: 同模型自评估存在偏见；跨模型验证提供独立信号——与Error Log外部验证完全一致

---

## Experimental Results

**Dataset**: 25个专家策划的市场研究查询（传统需2-4周人工）

| Metric | Single-Agent | Static Pipeline | VMAO | Gain |
|--------|-------------|-----------------|------|------|
| **Completeness** | 3.1 | 3.5 | **4.2** | +35% vs Single |
| **Source Quality** | 2.6 | 3.2 | **4.1** | +58% vs Single |
| Avg Tokens | 480K | 620K | 890K | 验证开销 |

**按查询类别增益**:
- Strategic Assessment: +53%（最大增益，需跨维度合成）
- Competitive Intelligence: +41%
- Financial Investigation: +32%
- Performance Analysis: +18%（最小增益，数据源明确）

---

## OpenClaw Design Validation

### ✅ Aligned Elements

| VMAO Design | OpenClaw Correspondent |
|-------------|------------------------|
| Tier 1-2-3 Agent分层 | Main/Sub-agent/Skill架构 |
| ResultVerifier外部验证 | Error Log机制 |
| 跨模型验证(Opus验证Sonnet) | Human/Error Log外部评估 |
| 依赖感知并行执行 | `/btw`异步边界 |
| 结果保留(progressive refinement) | Error Log因果链 |
| Token预算硬限制 | P109边界控制 |
| 最大迭代限制(3次) | 有界迭代原则 |

### ⚠️ Boundary Tension

| VMAO Feature | OpenClaw Stance | Assessment |
|--------------|-----------------|------------|
| Adaptive Replanner动态重规划 | P109禁止运行时自进化 | **关键边界差异** |
| LLM-based动态子问题生成 | AGENTS.md编译期固定 | **需仔细辨析** |

**辨析**: VMAO的"Replanning"是**任务级重组**（子问题DAG调整），非**能力级修改**：
- ✅ 允许: 基于验证反馈重新排列/补充子问题（类似Error Log触发的Skill重试）
- ❌ 禁止: 修改Agent能力定义、工具实现、验证标准（P109核心）

VMAO的AdaptiveReplanner操作于**任务DAG层**(L3 Strategic Selection per HB#1481)，不触及L4/L5结构重组或生成式治理——与OpenClaw一致。

---

## L3 Flags

- #1492-A: 研究VMAO停止条件对Error Log学习循环的借鉴价值
- #1492-B: 评估跨模型验证(weak→strong)在Skill评审中的可行性
- #1492-C: 监控"Replanning"术语边界，防范向L4/L5能力修改的语义漂移

---

**Related**: HB#1481 (Control-Theoretic Agency Levels), HB#1475 (Plan-and-Act), HB#1478 (XSkill), SYNTH-008 (Agent Architecture Convergence)
