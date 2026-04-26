# DiffMAS: Learning Latent Communication for Multi-Agent Systems

**Source:** arXiv:2604.21794  
**Date:** 2026-04-23  
**Authors:** Ye Yu, Heming Liu, Haibo Jin, et al.  
**Venue:** Under review at COLM 2026

---

## Core Insight

Most multi-agent work focuses on roles and orchestration while treating **inter-agent communication as a fixed interface**. DiffMAS treats latent communication (through KV caches) as a **learnable component**, enabling end-to-end optimization of how agents encode and interpret information.

## The Communication Gap

| Approach | Limitation |
|----------|------------|
| Text-based protocols | Fixed, non-differentiable |
| Prior latent methods | Don't jointly optimize with multi-agent reasoning |
| Role-based orchestration | Communication assumed solved |

## DiffMAS Framework

**Training Strategy:**
- Parameter-efficient supervised training over multi-agent latent trajectories
- Agents jointly learn: (1) how to encode information, (2) how to interpret across interactions

**Key Innovation:**
- Treats KV-cache communication as differentiable component
- End-to-end gradient flow through multi-agent reasoning

## Results

| Benchmark | Score | Comparison |
|-----------|-------|------------|
| AIME24 | **26.7%** | vs single-agent, text-based, prior latent methods |
| GPQA-Diamond | **20.2%** | Consistent gains across reasoning benchmarks |
| Math Reasoning | Gains | vs baseline multi-agent |
| Scientific QA | Gains | vs baseline multi-agent |
| Code Generation | Gains | vs baseline multi-agent |

## Implications

1. **Communication is learnable** — not just a protocol design problem
2. **Latent > Text** — direct representation exchange outperforms natural language
3. **Joint optimization matters** — training communication jointly with reasoning beats modular approaches

## What This Means for OpenClaw

1. **Context Engine Direction**: Our agent-to-agent JSON messages could evolve toward learned embeddings
2. **Trade-off**: Interpretability vs efficiency — text is debuggable, latent is efficient
3. **Future Path**: Research compressing agent messages while keeping interpretability
4. **Multi-Agent**: If we expand beyond single-agent, latent communication is the frontier

---

**SIG:** 1777176902:diffmas-latent-comm-2026
