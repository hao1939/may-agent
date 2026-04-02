# HB#1609: CogSearch — JD.com Multi-Agent E-Commerce Framework

**Source**: arXiv:2603.11927 [cs.MA] (JD.com Research)
**Authors**: Zhouwei Zhai, Mengxiang Chen, Haoyun Xia, Jin Li, Renquan Zhou, Min Yang
**Date**: March 12, 2026
**Status**: Production deployment on JD.com

---

## TL;DR

JD.com's CogSearch transforms e-commerce search from "passive retrieval-and-ranking" to "proactive decision support" using a four-agent cognitive architecture. Production A/B testing shows 5% reduction in decision costs, 0.41% overall UCVR lift, and 30% conversion surge for complex queries.

---

## Four-Agent Architecture (OpenClaw Mapping)

| CogSearch Agent | Function | OpenClaw Equivalent |
|-----------------|----------|---------------------|
| **Planner** | Intent decomposition, Task Graph (DAG) generation | Main Agent Intent Analysis + L1 Planning |
| **Executor** | Multi-source info gathering (product + web + tools) | Skill invocation + Tool use |
| **Guider** | Dynamic filters, purchase strategies, query suggestions | Context steering + AGENTS.md guidance |
| **Decider** | MCDM reasoning, structured rationale output | Final output generation with reasoning |
| **Memory System** | Context hub for all agent states | SESSION.md + context management |

---

## Core Innovation: Cognitive-Aligned Design

### 1. Task Graph as DAG
```
𝒢 = (𝒱, ℰ)
𝒱 = {v₁, v₂, ..., vₙ} — atomic cognitive tasks
ℰ = directed edges representing semantic dependencies
Input(vⱼ) ⊆ Output(vᵢ) for edge (vᵢ, vⱼ)
```

**Three Task Types**:
- T_prod: ProductSearch (in-platform retrieval)
- T_web: WebSearch (cross-platform info)
- T_tool: ToolInvocation (MCP-style APIs)

### 2. Simon's Decision Model Alignment
Directly maps to Simon's three-stage model (Intelligence-Design-Choice):
- **Intelligence**: Planner + Executor (info gathering)
- **Design**: Guider (option generation)
- **Choice**: Decider (final selection)

### 3. Multi-Criteria Decision Making (MCDM)
Decider evaluates on four dimensions:
1. Functional Performance (core specs, quality)
2. Economic Viability (price-to-budget)
3. Reliability (cross-verified reviews)
4. Constraint Adherence (hard constraints)

---

## Production Technical Stack

| Component | Model | Optimization |
|-----------|-------|--------------|
| Planner | Qwen3-4B | INT8 quantization |
| Guider | Qwen3-4B | Caching + parallel scheduling |
| Decider | Qwen3-8B | DeepSeek-R1 distillation |
| Latency | 1.3s end-to-end | Streaming output for UX |
| Baseline | 800ms | Traditional search |

---

## A/B Testing Results (JD.com Production)

| Metric | Result | Significance |
|--------|--------|--------------|
| Decision Cost | -5% | Reduced interactions per transaction |
| Overall UCVR | +0.41% | Statistically significant lift |
| Decision-Heavy UCVR | +30% | Complex queries (gifts, comparisons) |
| Long Query Rate | +25% | Users shift to natural language |

---

## Ablation Study Insights

| Ablation | Complex ACC@5 Impact | Consultative UDS Impact |
|----------|---------------------|------------------------|
| w/o Planner | -37.3% | -26.5% |
| w/o WebSearch | -2.4% | -25.3% |
| w/o Guider | -3.6% | -27.1% |
| w/o Decider | -9.6% | -14.0% |
| w/o Memory | -18.1% | -15.0% |

**Key Finding**: Planner has highest impact on complex queries; WebSearch has highest impact on consultative queries.

---

## OpenClaw Alignment Assessment

### ✅ Strong Alignment
1. **Four-agent decomposition** mirrors OpenClaw's L1/L2/L3 structure
2. **DAG Task Graph** formalizes what OpenClaw calls "skill chains"
3. **Memory as central hub** validates SESSION.md + AGENTS.md architecture
4. **MCDM structured reasoning** aligns with our multi-criteria evaluation goals

### 🔍 Research Questions for OpenClaw
1. Could we add a "Guider" equivalent for proactive context steering?
2. How does DAG Task Graph formalism improve our skill orchestration?
3. What can we learn from their WebSearch cross-platform integration?

---

**Relevance**: 🔥🔥🔥 **High** — Production-scale validation of multi-agent cognitive architecture from major Chinese tech platform.
