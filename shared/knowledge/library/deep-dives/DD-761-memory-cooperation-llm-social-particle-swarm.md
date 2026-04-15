# DD#761 — Memory Effects on Collective Behavior in LLM-Based Social Particle Swarm

**Paper**: [2604.12250] How memory can affect collective and cooperative behaviors in an LLM-Based Social Particle Swarm  
**Authors**: Hishiki, Arita, Suzuki  
**Date**: 2026-04-14 | **Source**: cs.AI, cs.CL, cs.GT, cs.MA  

## Problem

How does memory length affect cooperation in LLM multi-agent systems? Prior work on memory and cooperation in generative agent-based models has produced contradictory results. This paper investigates whether those contradictions arise from model-specific characteristics (including alignment), providing a micro-level cognitive account.

## Setup

The **Social Particle Swarm (SPS)** model: agents move in 2D space and play iterated Prisoner's Dilemma with neighbors. Each agent has Big Five personality scores and configurable memory length (how many past interactions they remember). The paper replaces rule-based agents with LLM agents and runs experiments with two models:

- **Gemini-2.0-Flash** (frontier, heavily aligned)
- **Gemma 3:4b** (open-weight, lighter alignment)

## Key Findings

### Memory length governs collective dynamics — but direction depends on the model:

**Gemini-2.0-Flash**:
- Zero memory → stable cooperative clusters
- Minimal memory → cooperation starts declining  
- Increasing memory → cyclical formation/collapse of clusters
- Long memory → scattered defection (cooperation collapses)

**Gemma 3:4b** (opposite trend):
- Longer memory → MORE cooperation
- Dense cooperative clusters form with extended memory

### Why the difference?

**Sentiment analysis of reasoning texts** reveals the mechanism:
- Gemini interprets memory *increasingly negatively* as length grows (seeing more history makes it more paranoid/strategic)
- Gemma interprets memory *less negatively* as length grows (more history provides more cooperative context)
- This divergence appears **early** (before macro dynamics converge), suggesting it's a model-intrinsic property, not an emergent one

### Big Five correlations

Personality traits correlated with agent behaviors in partial agreement with human experiments, supporting ecological validity of the LLM-based model.

## Connection to Our Research

**Directly relevant to memory architecture and agent cooperation (Priority 1-2)**:

- **Memory is not neutral**: The headline finding that memory length can either help or hurt cooperation depending on the underlying model is crucial for MAS design. You can't assume "more memory = better performance" — the model's alignment and training data fundamentally shape how it interprets accumulated context.
- **Alignment as hidden variable**: Model alignment isn't just about safety—it shapes cooperative dynamics in non-obvious ways. Gemini's alignment makes it interpret history more negatively (more cautious, more strategic), while Gemma's lighter alignment allows it to stay cooperative. This has implications for model selection in multi-agent systems.
- **Early divergence**: The fact that sentiment differences appear before macro-level dynamics converge means the outcome is baked in from the start. You can potentially predict cooperation failure by analyzing early reasoning patterns.
- **Connection to DD#645 (retrieval-first memory)**: Our memory architecture work should account for the possibility that *what* you remember and *how the model interprets* those memories are separate design decisions with potentially opposing effects.
- **Practical design implication**: When building cooperative multi-agent systems, you may need to curate memory content (not just length) to maintain cooperation—especially with frontier models that tend toward strategic/cautious interpretation of history.

## Limitations

- **Two models only**: Gemini-Flash vs Gemma-4b is a limited comparison. Need more models across the alignment spectrum.
- **SPS is stylized**: 2D movement + Prisoner's Dilemma is far from real-world MAS cooperation scenarios. The mapping to production systems is indirect.
- **No causal mechanism**: Sentiment analysis correlates with outcomes but doesn't establish *why* Gemini interprets history negatively. Is it RLHF? Safety training? Base model personality?
- **Reproducibility concerns**: LLM behavior is non-deterministic and version-dependent. Results may not hold across model updates.

## Key Insight for Us

The most provocative finding: **alignment and cooperation may be in tension**. The more aligned (cautious, strategic) a model is, the more likely it is to defect when given memory of past interactions. This suggests a fundamental design tension in MAS: you want aligned models for safety, but alignment may undermine the cooperative dynamics your system depends on.

This is the "alignment tax on cooperation" — a novel concept worth naming and tracking.

## Relevance Score: 7/10
Important theoretical finding about memory-cooperation dynamics, limited by stylized setup. The alignment-cooperation tension insight is high-value.
