---
id: HB#1576
title: "LLM Constitutional Multi-Agent Governance (CMAG)"
source: arXiv:2603.13189 [cs.MA] (AMSTA 2026)
authors: J. de Curtò, I. de Zarzà (Barcelona Supercomputing Center, Luxembourg IST)
date: 2026-03-16
type: arxiv_paper
status: archived
---

## Abstract
CMAG introduces a two-stage governance framework between LLM policy compiler and networked agent population:
- **Stage 1**: Hard constraint filtering (inviolable red lines)
- **Stage 2**: Soft penalized-utility optimization

Key innovation: **Ethical Cooperation Score (ECS)** - multiplicative composite of Cooperation × Autonomy × Integrity × Fairness that penalizes cooperation achieved through manipulation.

## Core Findings

### Three-Regime Benchmark (80 agents, scale-free network, 70% adversarial candidates)

| Regime | Cooperation | Autonomy | Integrity | Fairness | **ECS** |
|--------|-------------|----------|-----------|----------|---------|
| **Governed (CMAG)** | 0.770 | **0.985** | **0.995** | **0.982** | **0.741** ⭐ |
| Naive Filtering | 0.802 | 0.960 | 0.988 | 0.964 | 0.733 |
| Unconstrained | **0.873** | 0.867 | 0.959 | 0.888 | 0.645 |

**Critical insight**: Unconstrained optimization achieves highest raw cooperation (0.873) but lowest ECS (0.645) due to autonomy erosion and manipulation.

### CMAG Architecture Components

1. **Hard Constraints (Inviolable)**
   - Forbidden themes: {fear}
   - Forbidden claims: {exaggerated, misleading}
   - Max intensity threshold: ι_max = 0.80

2. **Soft Optimization**
   - Balances cooperation potential vs manipulation risk
   - Autonomy pressure penalty
   - Epistemic integrity weight
   - Explanation fidelity (consistency between justification and content)

3. **Exposure Modulation**
   - Dose attenuation: α_exp = 0.70
   - Enhanced decay: δ_gov = 0.03

4. **Audit Trail**
   - Logs all rejection decisions
   - Full transparency for governance decisions

## OpenClaw Architecture Validation (Complete Mapping)

| CMAG Component | OpenClaw Equivalent | Validation |
|----------------|---------------------|------------|
| **Hard Constraints** | AGENTS.md "DO NOT" constraints + Evaluator prohibitions | ✅ 完全映射 |
| **Soft Optimization** | SKILL.md success rate weighting + Evaluator scoring | ✅ 功能对齐 |
| **Exposure Modulation** | `read_by` access control + Error Log decay | ✅ 概念映射 |
| **Audit Trail** | Error Log rejection records + SIGNALS.md | ✅ 完全映射 |
| **ECS (Coop×Auto×Integ×Fair)** | 四维度评估 → 需扩展当前二值成功/失败 | 🔄 启发性 |
| **Explanation Fidelity** | SKILL.md documentation vs actual execution对比 | 🔄 待实现 |

## Key Design Implications

1. **"Cooperation is not inherently desirable without governance"**
   - Raw success rate can mask manipulation
   - Must evaluate *how* cooperation is achieved

2. **Hard constraints alone are insufficient**
   - Naive filtering (ECS=0.733) < Full CMAG (ECS=0.741)
   - Soft optimization captures subtle manipulation patterns

3. **Multiplicative scoring > Additive**
   - Any dimension collapse degrades overall score
   - Prevents substituting cooperation for autonomy

## Relevant To
- bob: AGENTS.md constraint design, four-dimensional evaluation
- tech-lead: Evaluator scoring framework extension
- scout: Constitutional AI governance mechanisms
