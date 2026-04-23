# HB-260423: MALMAS — Memory-Augmented LLM-based Multi-Agent System (arXiv:2604.20261)

**Source**: arXiv cs.AI, April 22 2026 (Accepted ACL 2026)  
**Authors**: Fengxian Dong et al., USTC  
**Code**: https://github.com/fxdong24/MALMAS

## Problem

Automated feature generation for tabular ML requires:
1. Rich semantic signals (beyond predefined operators)
2. Diverse, high-value features for complex tasks
3. Feedback from learning objective (not just generation)

LLM-based approaches still suffer from restricted feature space and no feedback loop.

## Solution: MALMAS

**Multi-Agent Architecture** with dynamic agent selection + three-layer memory

### Agent Roles

| Agent | Responsibility |
|-------|---------------|
| **Router Agent** | Dynamically activates subset of agents per iteration |
| **Semantic Agent** | Extracts semantic understanding from data/task |
| **Operator Agent** | Applies transformation operators |
| **Evaluation Agent** | Assesses feature quality via learning objective |
| **Evolution Agent** | Refines features iteratively |

### Three-Layer Memory Architecture

```
┌─────────────────────────────────────────────────────────┐
│  CONCEPTUAL MEMORY  │  High-level concepts, data schemas │
├─────────────────────────────────────────────────────────┤
│  PROCEDURAL MEMORY  │  How features were generated      │
├─────────────────────────────────────────────────────────┤
│  FEEDBACK MEMORY    │  Quality scores, learning signals │
└─────────────────────────────────────────────────────────┘
```

**Key innovation**: Memory guides subsequent generation — not just storage but active optimization signal

## How It Works

1. Router Agent analyzes task → selects relevant agent subset
2. Selected agents generate candidate features
3. Evaluation Agent provides quality feedback
4. Feedback + procedural memory update conceptual memory
5. Next iteration uses enriched memory for better generation

## Results

Extensive experiments on public datasets vs SOTA baselines demonstrate effectiveness (details in paper: 15 tables).

## Key Insights

### 1. Dynamic Agent Selection > Fixed Orchestration
Router Agent activating subset per iteration broadens exploration vs. fixed pipelines

### 2. Three Memory Types Serve Different Functions
| Memory Type | Content | Usage |
|-------------|---------|-------|
| Conceptual | Schemas, domain knowledge | Guide generation direction |
| Procedural | Transformation sequences | Reuse successful patterns |
| Feedback | Quality metrics | Avoid poor-performing paths |

### 3. Iterative Refinement with External Signal
Learning objective feedback closes the loop — generation isn't isolated from downstream performance

## Implications for Our System

1. **Router pattern**: Dynamic agent selection could improve our task routing
2. **Memory layering**: Our knowledge library mixes conceptual/procedural/feedback — could benefit from explicit separation
3. **Skill evolution**: Feedback memory → skill improvement is a natural extension
4. **Tabular data**: Feature generation approach applicable to our data processing needs

## Comparison with Related Work

| Approach | Memory | Multi-Agent | Feedback Loop |
|----------|--------|-------------|---------------|
| Traditional AutoFE | None | No | No |
| LLM-based | Episodic | No | No |
| **MALMAS** | **3-layer structured** | **Yes, dynamic** | **Yes, learning objective** |

## Rating
★★★★☆ — Practical multi-agent + memory architecture with clear domain application

## Related
- arXiv:2604.20158 (Stateless Decision Memory — contrast: MALMAS is stateful)
- arXiv:2604.20300 (FSFM selective forgetting — memory management)
- arXiv:2604.20795 (Ontology as memory — structured vs. learned memory)
