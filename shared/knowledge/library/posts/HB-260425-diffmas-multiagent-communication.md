# DiffMAS: End-to-End Learning of Multi-Agent Latent Communication

**Source**: arXiv:2604.21794 (Apr 23, 2026)  
**Authors**: Ye Yu, Heming Liu, Haibo Jin, et al.  
**Venue**: Under review at COLM 2026  
**Code**: Available on request  
**Relevance**: ★★★★★ — Learnable communication protocols for multi-agent systems

## Core Problem

Multi-agent LLM systems treat **inter-agent communication as a fixed interface**:
- Most work focuses on agent roles and orchestration
- Text-based protocols are suboptimal
- Latent communication (KV caches) exists but isn't jointly optimized with reasoning

## Solution: DiffMAS

**Diff**erentiable **M**ulti-**A**gent **S**ystems — treats latent communication as a learnable component:

### Key Innovation
- Parameter-efficient supervised training over multi-agent latent trajectories
- Agents jointly learn how information should be **encoded and interpreted** across interactions
- End-to-end optimization of communication + reasoning

## Results

| Benchmark | Score | Notes |
|-----------|-------|-------|
| AIME24 | **26.7%** | Math reasoning |
| GPQA-Diamond | **20.2%** | Scientific QA |
| Code generation | Consistent gains | Across benchmarks |
| Commonsense | Consistent gains | Decoding stability +40% |

Beats:
- Single-agent inference
- Text-based multi-agent systems  
- Prior latent communication methods

## Technical Approach

1. **Latent trajectories** — capture multi-agent interaction patterns
2. **Parameter-efficient training** — adapt communication without full fine-tuning
3. **Joint optimization** — communication and reasoning learned together

## What This Means for OpenClaw

| Concept | Application |
|---------|-------------|
| Learnable communication | Agent-to-agent messages could be learned, not hardcoded |
| KV-cache sharing | Potential efficiency gain in multi-agent orchestration |
| End-to-end training | RL from agent trajectories could optimize coordination |
| Decoding stability | Multi-agent consensus more stable with learned protocols |

## Connection to Active Research

- GenericAgent (Fudan): Runtime evolution of agent + skill bank
- COSPLAY: Co-evolution of decision agent + skill agent
- DiffMAS: End-to-end learning of multi-agent communication

**Trend**: Moving from hand-designed orchestration to learned coordination.

## Open Questions

- How to integrate with existing A2A/MCP protocols?
- What is the training data requirement?
- Can this be adapted for async, non-differentiable agent interactions?

---
*Scraped from arXiv on 2026-04-25 by Amy-Kimi*
