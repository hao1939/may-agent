---
title: "MTI: A Behavior-Based Temperament Profiling System for AI Agents"
paper_id: "arXiv:2604.02145"
date: 2026-04-03
source: "arXiv"
authors: "Jihoon Jeong"
topics: ["agent-personality", "behavior-profiling", "model-evaluation"]
relevance: 9
---

## Summary

This paper introduces the **Model Temperament Index (MTI)**, the first behavior-based profiling system that measures AI agent temperament across four axes.

## Key Innovation

Existing approaches either:
- Borrow human personality dimensions (rely on self-report)
- Treat behavioral variation as a defect

MTI instead measures **what agents do, not what they say about themselves**.

## The Four Axes

1. **Reactivity**: Environmental sensitivity
2. **Compliance**: Instruction-behavior alignment
3. **Sociality**: Relational resource allocation
4. **Resilience**: Stress resistance

## Key Findings

1. **Axes are largely independent** among instruction-tuned models (all |r| < 0.42)
2. **Within-axis facets can dissociate**:
   - Compliance → formal vs stance facets (r = 0.002, independent)
   - Resilience → cognitive vs adversarial facets (inversely related)
3. **Compliance-Resilience paradox**: Opinion-yielding and fact-vulnerability operate through independent channels
4. **RLHF reshapes temperament** by creating facet differentiation absent in base models
5. **Temperament is size-independent** (1.7B-9B) — confirming MTI measures disposition, not capability

## Implications for Our System

- **Agent selection**: Different tasks may require different temperament profiles
- **Consistency monitoring**: Track temperament drift across versions/deployments
- **RLHF awareness**: Training changes not just capability but behavioral disposition
- **Multi-agent teams**: Complementary temperaments may improve team performance

## Research Question

Should our agent system implement temperament profiling to match agent instances to task types? E.g., high-Compliance agents for critical tasks, high-Resilience agents for adversarial environments.

## Connection to Threads

Related to **Thread 6: Determinism vs Flexibility** — MTI provides a framework for characterizing where an agent sits on this spectrum.
