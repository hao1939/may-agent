# HB#1691 — ToolTree Paper Archive

**Source**: arXiv:2603.12740v1 [cs.AI] 13 Mar 2026
**Title**: ToolTree: Efficient LLM Agent Tool Planning via Dual-Feedback Monte Carlo Tree Search and Bidirectional Pruning
**Authors**: Shuo Yang, Soyeon Caren Han, Yihao Ding, Shuhe Wang, Eduard Hovy (University of Melbourne)
**Venue**: ICLR 2026
**Code**: https://github.com/SYang2000/ICLR_2026_ToolTree

## Abstract

ToolTree presents a Monte Carlo tree search-inspired planning paradigm for LLM agent tool use. It uses dual-stage LLM evaluation (pre-execution prior + post-execution utility) and bidirectional pruning to enable informed, adaptive decisions over extended tool-use sequences.

## Key Mechanisms

### Dual Evaluation
1. **Pre-evaluation (r_pre)**: Fast predictive signal before tool execution
   - LLM judges tool usefulness based on context + tool card
   - Gates expansion: only r_pre ≥ τ_pre are expanded
   - Enters UCT selection formula as prior

2. **Post-evaluation (r_post)**: Grounded score after execution
   - Evaluates actual output utility
   - Updates Q(s,a) via backward propagation
   - Drives exploitation term

### Bidirectional Pruning
- **Pre-pruning**: Discard low r_pre branches before expansion
- **Post-pruning**: Mark branches non-expandable if r_post < threshold
- **Caching**: (a,args) ↦ o to avoid duplicate calls

### UCT Formula
```
UCT(s,a) = Q(s,a) + λ·r_pre(s,a)·√(ln N(s)/N(s,a))
```

## Benchmarks
- Closed-set: GTA (14 tools), m&m (33 tools)
- Open-set: ToolBench (16,464 APIs), RestBench (143 APIs)

## Results

### GTA (GPT-4o)
| Method | AVG Score |
|--------|-----------|
| Zero-Shot | 57.78 |
| ReAct | 58.46 |
| CoT | 56.69 |
| ToT | 60.40 |
| A* | 62.52 |
| LATS | 64.78 |
| **ToolTree** | **66.95** |

### Efficiency
- Sweet spot: 32-64 steps
- Highest accuracy-per-second across all methods
- Token cost: 18.2k (vs 24.3k without dual evaluation)

## Ablation Study (GTA, GPT-4o)

| Variant | Accuracy | Token Cost |
|---------|----------|------------|
| ToolTree (full) | 76.44 | 18.2k |
| - Pre-pruning | 75.28 | 20.4k |
| - Pre-evaluation | 71.80 | 21.1k |
| - Post-pruning | 75.82 | 22.9k |
| - Post-evaluation | 68.94 | 22.9k |
| - Both pruning | 74.58 | 24.1k |
| - Both evaluation | 66.70 | 24.3k |

**Key finding**: Post-evaluation is MORE critical than pre-evaluation (7.5 point drop vs 4.6 point drop).

## OpenClaw Connections

1. **Error Log validation**: Post-evaluation mechanism aligns with OpenClaw's step-level quality assessment
2. **Skill schema validation**: Pre-pruning via type checking aligns with OpenClaw Skills
3. **Tension**: MCTS speculative expansion vs OpenClaw deterministic DAG execution

## Archive Metadata
- **HB ID**: 1691
- **Category**: Tool Planning / MCTS
- **Related Papers**: LATS, ToT, A* Search, ReAct
- **Discovered**: 2026-03-16
