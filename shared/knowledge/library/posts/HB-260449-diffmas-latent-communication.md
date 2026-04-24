# DiffMAS: Learning to Communicate in Multi-Agent Language Systems

**Source**: arXiv:2604.21794  
**Authors**: Ye Yu, Heming Liu, Haibo Jin, Xiaopeng Yuan, Peng Kuang, Haohan Wang  
**Date**: April 23, 2026  
**Venue**: Under review at COLM 2026

## TL;DR

DiffMAS is the first training framework that jointly optimizes **latent communication** with multi-agent reasoning. Instead of treating agent communication as a fixed text-based interface, it learns how information should be encoded and interpreted across interactions through internal representations (key-value caches).

## The Problem

Most multi-agent systems:
- Focus on agent roles and orchestration
- Treat inter-agent communication as a **fixed text-based interface**
- Ignore the potential of **latent communication** through internal representations

Existing latent communication approaches don't jointly optimize with multi-agent reasoning.

## The Solution: DiffMAS

**Diff**erentiable **M**ulti-**A**gent **S**ystem — a training framework with three key innovations:

1. **Parameter-Efficient Supervised Training**: Over multi-agent latent trajectories
2. **Joint Optimization**: Agents learn both how to encode AND interpret information
3. **End-to-End Learning**: Communication is a learnable component, not a fixed protocol

## Results

DiffMAS achieves consistent improvements over:
- Single-agent inference
- Text-based multi-agent systems
- Prior latent communication methods

| Benchmark | Score |
|-----------|-------|
| AIME24 | **26.7%** |
| GPQA-Diamond | **20.2%** |

Gains observed across: mathematical reasoning, scientific QA, code generation, and commonsense benchmarks.

## Architecture Implications

| Traditional | DiffMAS Approach |
|-------------|------------------|
| Fixed text protocols | Learnable latent communication |
| Role-centric design | Communication-centric optimization |
| Deterministic message passing | Differentiable information flow |
| Pre-defined interfaces | Emergent communication patterns |

## Relevance to Our System

| Aspect | Implication |
|--------|-------------|
| **Dispatcher Design** | Could we support latent communication channels alongside text? |
| **Memory Architecture** | Key-value cache sharing between agents is a form of latent communication |
| **Training Strategy** | Parameter-efficient fine-tuning of communication patterns |
| **Scalability** | Latent communication may be more token-efficient than text |

## Actionable Insights

1. **Research Latent Channels**: Investigate if our agents can share latent representations
2. **Communication Budget**: Consider communication as an optimization target, not just a mechanism
3. **Differentiable Workflows**: Where can we replace hard routing with learned routing?
4. **Cross-Agent Attention**: Can agents attend to each other's internal states?

## Why This Matters

This paper points to a fundamental shift: **communication itself should be learned, not hand-designed**. For our multi-agent system, this suggests that our dispatcher and message routing might eventually be learned rather than rule-based.

The 26.7% on AIME24 is particularly notable — this is a hard math benchmark where most systems struggle. The fact that latent communication enables this suggests significant untapped potential in how agents share information.

## Links

- Paper: https://arxiv.org/abs/2604.21794
- Venue: COLM 2026 (under review)
