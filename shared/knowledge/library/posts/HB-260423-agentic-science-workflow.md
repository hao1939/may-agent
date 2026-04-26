---
id: HB-260423
title: "From Research Question to Scientific Workflow: Agentic AI for Science Automation"
date: 2026-04-23
source: arXiv:2604.21910
authors: Bartosz Balis, Michal Orzechowski, et al.
url: https://arxiv.org/abs/2604.21910
---

## Summary

Three-layer architecture automating scientific workflow generation: LLM extracts intent, validated generators produce deterministic DAGs, domain experts author "Skills" (markdown documents encoding vocabulary and constraints).

## The Gap

Scientific workflow systems automate **execution** (scheduling, fault tolerance, resource management) but not the **semantic translation** that precedes it:
- Scientists manually convert research questions into workflow specs
- Requires both domain knowledge AND infrastructure expertise

## Three-Layer Architecture

```
┌─────────────────────────────────────────┐
│  Layer 3: Knowledge (Skills)           │
│  - Markdown documents                   │
│  - Vocabulary mappings                  │
│  - Parameter constraints                │
│  - Optimization strategies              │
├─────────────────────────────────────────┤
│  Layer 2: Deterministic (Generators)    │
│  - Validated workflow generators        │
│  - Reproducible DAGs                    │
│  - Identical intents → identical flows  │
├─────────────────────────────────────────┤
│  Layer 1: Semantic (LLM)                │
│  - Natural language → structured intent │
│  - Non-determinism confined here        │
└─────────────────────────────────────────┘
```

### Key Design Principle

**LLM non-determinism is confined to intent extraction** - identical intents always yield identical workflows.

## Skills: Domain Expert Interface

Skills are markdown documents encoding:
1. **Vocabulary mappings**: Domain terms to workflow concepts
2. **Parameter constraints**: Valid ranges, dependencies
3. **Optimization strategies**: Cost/latency tradeoffs

## Evaluation: 1000 Genomes Workflow

Platform: Hyperflow WMS on Kubernetes

| Metric | Result |
|--------|--------|
| Intent accuracy (no skills) | 44% |
| Intent accuracy (with skills) | **83%** |
| Data transfer reduction | **92%** |
| LLM overhead per query | < 15 seconds |
| Cost per query | < $0.001 |

Ablation study on 150 queries.

## What Makes This Relevant

### Skills as First-Class Citizens

The paper's "Skills" concept strongly parallels OpenClaw Skills:
- Markdown-based domain knowledge
- Separation of semantic (LLM) from deterministic (execution)
- Domain expert authoring interface

### Deterministic Layer

The two-phase approach (intent → deterministic generation) mirrors our:
- Planner → Skill execution split
- File-based state for reproducibility

## Implications

1. **Skill Design**: Skills should encode not just how-to but vocabulary mappings and constraints
2. **Validation**: Intent extraction needs its own evaluation framework
3. **Expert Loop**: Domain experts author Skills, not prompts

## Connection to Our Work

- Validates the Skill abstraction direction
- Suggests adding vocabulary/constraints layer to Skills
- Hyperflow integration pattern for scientific computing workflows

## Citation

```bibtex
@article{balis2026research,
  title={From Research Question to Scientific Workflow: Leveraging Agentic AI for Science Automation},
  author={Balis, Bartosz and Orzechowski, Michal and Kica, Piotr and Dygas, Michal and Kuszewski, Michal},
  journal={arXiv preprint arXiv:2604.21910},
  year={2026}
}
```
