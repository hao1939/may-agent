# From Research Question to Scientific Workflow: Agentic AI for Science Automation

**Source**: arXiv:2604.21910  
**Authors**: Bartosz Balis, Michal Orzechowski, Piotr Kica, Michal Dygas, Michal Kuszewski  
**Date**: April 23, 2026

## TL;DR

A three-layer agentic architecture that automates the translation from natural language research questions to reproducible scientific workflows. Achieves 83% intent accuracy (up from 44%) and reduces data transfer by 92% through skill-driven deferred generation.

## The Problem

Scientific workflow systems automate execution (scheduling, fault tolerance, resource management) but NOT the semantic translation that precedes it:

- Scientists manually convert research questions → workflow specifications
- Requires both domain knowledge AND infrastructure expertise
- LLM non-determinism makes reproducibility challenging

## The Solution: Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  KNOWLEDGE LAYER                                            │
│  Domain experts author "Skills":                            │
│  - Vocabulary mappings                                      │
│  - Parameter constraints                                    │
│  - Optimization strategies                                  │
├─────────────────────────────────────────────────────────────┤
│  SEMANTIC LAYER                                             │
│  LLM interprets natural language → structured intents       │
├─────────────────────────────────────────────────────────────┤
│  DETERMINISTIC LAYER                                        │
│  Validated generators produce reproducible workflow DAGs    │
│  Identical intents → identical workflows                    │
└─────────────────────────────────────────────────────────────┘
```

**Key Innovation**: Confine LLM non-determinism to intent extraction; everything downstream is deterministic.

## Results

Evaluated on 1000 Genomes population genetics workflow + Hyperflow WMS on Kubernetes:

| Metric | Result |
|--------|--------|
| Intent accuracy (without Skills) | 44% |
| Intent accuracy (with Skills) | **83%** |
| Data transfer reduction | **92%** |
| LLM overhead per query | < 15 seconds |
| Cost per query | < $0.001 |

## The "Skills" Abstraction

Skills are **markdown documents** encoding:
- Domain vocabulary mappings
- Parameter constraints and validation rules
- Optimization strategies for workflow generation

This bridges the gap between natural language and executable workflows through structured, human-authored knowledge.

## Relevance to Our System

| Concept | Application to Our System |
|---------|---------------------------|
| **Skills as Knowledge Layer** | Our skills could include parameter constraints and optimization hints |
| **Intent → Structured Plan** | Our dispatcher could extract structured intent before routing |
| **Deterministic Layer** | Task execution should be deterministic given a fixed plan |
| **Reproducibility** | Identical prompts should yield identical workflows |

## Actionable Insights

1. **Skill Metadata**: Add optimization hints and constraints to our skill definitions
2. **Intent Structuring**: Extract structured intent before dispatch to reduce ambiguity
3. **Deterministic Execution**: Separate planning (LLM) from execution (deterministic)
4. **Knowledge Layer**: Consider markdown-based skill definitions with validation schemas

## Why This Matters

This paper provides a **principled architecture for reliable agentic systems**:

- LLMs handle what they're good at (understanding intent)
- Deterministic systems handle what they're good at (reliable execution)
- Human experts provide domain knowledge through structured "Skills"

The three-layer separation is a design pattern we can apply: **Knowledge + Semantic + Deterministic**.

For scientific computing, this achieved 83% accuracy with sub-second latency and near-zero cost. The pattern likely generalizes to other domains.

## Links

- Paper: https://arxiv.org/abs/2604.21910
