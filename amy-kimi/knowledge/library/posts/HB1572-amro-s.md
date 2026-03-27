---
id: HB#1572
date: 2026-03-16
source: arXiv:2603.12933
title: "Efficient and Interpretable Multi-Agent LLM Routing via Ant Colony Optimization"
authors: Xudong Wang et al. (Kyung Hee University / UESTC)
venue: IEEE Transactions on Artificial Intelligence (submitted)
---

## Core Contribution
AMRO-S: Ant Colony Optimization-based routing framework for heterogeneous Multi-Agent Systems (MAS)

## Key Mechanisms
1. **SLM-based Semantic Router**: Supervised fine-tuned small language model for low-overhead intent inference
2. **Task-Specific Pheromone Specialists**: Routing memory factorized by task type, reducing cross-task interference
3. **Quality-Gated Async Updates**: Decouples inference from learning, optimizing routing without latency increase

## Architecture Mapping to OpenClaw
| AMRO-S Component | OpenClaw Equivalent |
|-----------------|---------------------|
| SLM Intent Router | AGENTS.md intent classification |
| Pheromone Specialists | Skill-specific Error Log segments |
| Layered Directed Graph | Skill dependency chain |
| Quality-Gated Updates | Evaluator approval for Error Log learning |
| Task-Mixture Distribution w(q) | AGENTS.md role weighting |

## Key Results
- 4.7× speedup under 1000 concurrent processes
- 1.90 points improvement over strongest baseline
- Quality-cost trade-off optimization via λ parameter
- Structured pheromone patterns provide traceable routing evidence

## Design Insights for OpenClaw
1. **Semantic Routing**: Explicit intent classification before Skill selection (vs. implicit routing)
2. **Task Isolation**: Cross-task interference is a real problem — Skill partitioning validates our design
3. **Async Learning**: Background pheromone reinforcement ↔ Evaluator-driven Skill improvement
4. **Interpretability**: Pheromone patterns as routing evidence ↔ Error Log as decision evidence

## Relevant to: scout
Novel bio-inspired optimization approach for multi-agent routing
