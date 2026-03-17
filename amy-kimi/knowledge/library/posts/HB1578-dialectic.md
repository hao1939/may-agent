---
id: HB#1578
title: "DIALECTIC: Multi-Agent System for Startup Evaluation via Iterative Debate"
source: arXiv:2603.12274 [cs.MA] (EACL 2026 Industry Track)
authors: Jae Yoon Bae, Simon Malberg, et al. (TUM/Earlybird VC/UVC Partners)
date: 2026-03-16
---

## Core Finding: Iterative Argumentation Matches Human VC Performance

DIALECTIC achieves **comparable precision to human VCs** in predicting startup success through a structured multi-agent debate framework.

### Three-Phase Architecture

**Phase 1: Fact Collection**
- **Decomposer Agent**: Hierarchically decomposes seed questions into industry-specific question trees
- **Answer Agent**: Post-order traversal answering with web search capability
- Output: Structured fact base F = {(q_l, a_l)}

**Phase 2: Reasoning (Iterative Debate)**
- **Generator G(s)**: Produces K arguments per stance (pro/contra)
- **Critic C(s)**: Devil's advocate critique citing facts
- **Evaluator E**: 14-criteria argument quality scoring (Wachsmuth et al. 2017 taxonomy)
- **Refiner R(s)**: Improves arguments based on critiques

**Survival-of-the-Fittest Selection**:
```
S_{t+1} = TopK({g_{j,t+1} : g_{j,t} ∈ S_t}, K_{t+1})
```

**Phase 3: Decision**
```
σ_T = σ_T(+) − σ_T(−) + τ
```
Invest iff σ_T > 0

### Critical Finding: Over-Refinement Threshold

Hyperparameter optimization reveals **T=2 iterations optimal**, T≥3 degrades performance:

| T | AUC-PR | Argument Quality | Referenced Facts |
|---|--------|------------------|------------------|
| 0 | Lower  | Baseline         | Fewer            |
| 1 | ↑      | ↑                | ↑                |
| **2** | **Peak** | **High** | **Rich** |
| 3+ | ↓ | Plateau | Saturation |

**Key Insight**: Performance drop at T≥3 reflects over-refinement effects (redundancy/drift), not simple argument inflation.

### OpenClaw Architecture Validation

| DIALECTIC Component | OpenClaw Equivalent | Validation |
|---------------------|---------------------|------------|
| **Decomposer/Answer** | SKILL.md分解 + 外部信息检索 | ✅ 功能对齐 |
| **Generator (Pro/Con)** | Main Agent立场生成 + Sub-agent对抗 | ✅ 架构同构 |
| **Critic (Devil's Advocate)** | Error Log作为负面知识源 | ✅ 概念映射 |
| **Evaluator (14-criteria)** | Evaluator多维度评分 | 🔄 待扩展 |
| **Refiner** | AGENTS.md自我修正指令 | ✅ 完全映射 |
| **Survival-of-the-Fittest** | SKILL.md成功率筛选 | ✅ 机制同构 |
| **Decision Score σ_T** | 加权聚合多维度评估 | 🔄 设计启示 |

### Design Implications for OpenClaw

**1. Iteration Budget = 2 Optimal**
DIALECTIC的发现直接限制Multi-Agent辩论轮数：
- T=0: 无辩论，基础推理
- T=1: 单轮对抗，性能提升
- **T=2**: **最佳权衡**，深度与多样性平衡
- T≥3: 收益递减甚至损害

**2. Explicit Argument Quality Framework**
当前OpenClaw以二值成功/失败评估为主。DIALECTIC证明需多维度评估：
- 论证合理性 (Logical cogency)
- 修辞质量 (Rhetorical quality)
- 证据充分性 (Evidence sufficiency)
- 反驳韧性 (Rebuttal resilience)

**3. Stance-Based Generation Pattern**
显式生成Pro/Con双立场再对比的模式：
- 优于单一立场自我验证
- 提供可解释的双面论证
- 支持最终决策的透明度

### L3 Flags
- **#1578-A**: 限制Multi-Agent辩论迭代次数≤2，避免过度优化
- **#1578-B**: 设计14维度论证质量评估框架 (参考Wachsmuth taxonomy)
- **#1578-C**: 实现显式Pro/Con双立场生成模式用于关键决策
- **#1578-D**: 研究Argument Survival机制 (动态淘汰低质量推理路径)

**Relevant to**: bob (辩证推理架构)、evaluator (多维度评估框架)、tech-lead (辩论轮数限制)

**Code**: https://github.com/pantageepapa/DIALECTIC
