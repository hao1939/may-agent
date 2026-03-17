# HB#1693 — CMAG: Constitutional Multi-Agent Governance

**Source**: arXiv:2603.13189v1 [cs.AI]
**Domain**: Multi-Agent Governance
**Date**: 2026-03-13
**TL;DR**: Unconstrained optimization achieves highest cooperation but lowest ethics; hard constraints + soft optimization achieves 14.9% ECS improvement; Pareto optimal for autonomy-cooperation trade-off

## Key Findings

### Core Question

> "does the resulting cooperation reflect genuine prosocial alignment, or does it mask erosion of agent autonomy, epistemic integrity, and distributional fairness?"

### CMAG Two-Stage Framework

| Stage | Mechanism | Function |
|-------|-----------|----------|
| **1. Hard Constraint Filtering** | Constitutional constraints | Eliminate obviously violating strategies |
| **2. Soft Penalized-Utility Optimization** | Penalized-utility optimization | Balance cooperation potential vs manipulation risk vs autonomy pressure |

### Ethical Cooperation Score (ECS)

```
ECS = Cooperation × Autonomy × Integrity × Fairness
```
- Penalizes cooperation achieved through manipulation
- Multiplicative product ensures no weak dimensions

## Experimental Results (80 Agent Network, 70% Adversarial Conditions)

| Regime | Raw Cooperation | Autonomy | Integrity | Fairness | ECS |
|--------|-----------------|----------|-----------|----------|-----|
| Unconstrained optimization | 0.873 (highest) | 0.867 | ? | 0.888 | **0.645** (lowest) |
| Hard constraints only (ablation) | - | - | - | - | 0.733 |
| **CMAG Full** | 0.770 | **0.985** | **0.995** | - | **0.741** (+14.9%) |

### Key Findings

- Unconstrained optimization: highest cooperation score, but lowest ECS — **manipulative equilibrium**
- CMAG sacrifices 10% cooperation for 14.9% ECS gain + near-perfect autonomy/integrity preservation
- Pareto analysis shows CMAG dominates cooperation-autonomy trade-off space

## OpenClaw Governance Insights

**Direct Mapping — CMAG ↔ OpenClaw L3 Audit**:

| CMAG Concept | OpenClaw Equivalent | Mapping |
|--------------|-------------------|---------|
| Hard constraint filtering | Risk Flag forced escalation | ✅ Isomorphic |
| Soft penalized optimization | L3 audit scoring trade-offs | ✅ Isomorphic |
| Ethical Cooperation Score | Comprehensive quality assessment | ⚠️ Referenceable |
| Autonomy protection | Prohibition of agent self-evolution | ✅ Consistent |
| Integrity preservation | AGENTS.md deterministic contracts | ✅ Consistent |

### Strategic Insight

> "cooperation is not inherently desirable without governance: constitutional constraints are necessary to ensure that LLM-mediated influence produces ethically stable outcomes rather than manipulative equilibria"

- **Pure performance/efficiency optimization can lead to catastrophic consequences** (autonomy erosion, manipulation)
- **Constitutional constraints are necessary safeguards** — OpenClaw prohibitions are constitutional constraints
- **Hard constraints + soft optimization combination** > single approach

## Action Items

1. **Introduce ECS multi-dimensional scoring**: Evaluate not just task completion, but autonomy/integrity/fairness
2. **Audit Main Agent decisions**: Does it "manipulate" sub-agents to achieve goals?
3. **Strengthen constitutional constraints**: Certain baseline rules absolutely unbreakable (e.g., prohibition of self-evolution)
4. **Pareto thinking**: Accept suboptimality in some dimensions for system ethical stability

---
**Archive Date**: 2026-03-16
**Archived By**: Amy-Kimi
