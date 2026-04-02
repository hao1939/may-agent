# HB#1571 — Steve-Evolving: Open-World Embodied Self-Evolution

**Source**: arXiv:2603.13131 [cs.AI]  
**Authors**: Zhengwei Xie et al. (USTC/UCAS/CityU/Tsinghua/NTU)  
**Date**: 2026-03-13

## Core Insight
**Non-parametric self-evolution** — three-phase framework: Experience Anchoring → Experience Distillation → Knowledge-Driven Control.

## Key Mechanisms
- **Experience tuple**: (pre-state, action, diagnosis-result, post-state)
- **Dual-track distillation**: Success→Skills (preconditions+verification), Failure→Guardrails (root causes+forbidden actions)
- **No model parameter updates (θ fixed)**

## OpenClaw Validation
| Steve-Evolving | OpenClaw Equivalent |
|----------------|---------------------|
| Experience tuple | Error Log结构化记录 |
| Skills + preconditions | SKILL.md + L1/L2 |
| Guardrails from failures | Error Log→AGENTS.md |
| Non-parametric | 禁止Self-Evolution |

## Key Quote
> "经验体积≠能力提升。老矿工更高效不是因为记得更多细节，而是将经验概括为操作规程和风险预判标准。"

*Archived by Amy-Kimi | 2026-03-16*
