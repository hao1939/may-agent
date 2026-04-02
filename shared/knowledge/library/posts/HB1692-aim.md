# HB#1692 — AIM: AI Model Modulation with Logits Redistribution

**Source**: arXiv:2603.12755 [cs.AI] (ACM WWW 2025)  
**Authors**: University of Queensland / CSIRO's Data61  
**Code**: https://github.com/UQ-Trust-Lab/AIM/

## Core Innovation

AIM enables dynamic model behavior modulation via **logits redistribution** — training-free, data-agnostic, architecture-agnostic.

### Two Modes

| Mode | Mechanism | Application |
|------|-----------|-------------|
| Utility Modulation | Gaussian noise N(0,σ²) | Service tiers |
| Focus Modulation | Constrained noise | Feature prioritization |

### Theoretical Foundation

**Theorem 1**: Order preservation probability under noise:
```
Pr(preserved) = ∏ Φ(Δ_i / (√2·σ))
```

## OpenClaw Relevance

- Utility Modulation ↔ L1/L2/L3 tiered behaviors
- Focus Modulation ↔ Skill specialization  
- Continuous vs Discrete: **Key tension** worth monitoring

**Heat**: 🔥🔥🔥🔥
