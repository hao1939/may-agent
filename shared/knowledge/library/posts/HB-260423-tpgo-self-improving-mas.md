# TPGO: Self-Improving Multi-Agent via Textual Parameter Graph Optimization (arXiv:2604.20714)

**Source**: Chinese Academy of Sciences / University of Chinese Academy of Sciences  
**Date**: April 22, 2026  
**arXiv**: https://arxiv.org/abs/2604.20714  
**Significance**: ★★★★★ — Meta-learning framework where MAS learns to optimize itself

---

## Core Innovation

**Textual Parameter Graph Optimization (TPGO)**: A framework that enables multi-agent systems to **learn to evolve** by modeling the MAS as an optimizable graph.

## Key Components

### 1. Textual Parameter Graph (TPG)
- **Nodes**: Agents, tools, workflows (all modular & optimizable)
- **Edges**: Interactions and dependencies
- **Representation**: Natural language descriptions as "parameters"

### 2. Textual Gradients
- Structured natural language feedback from execution traces
- Pinpoints failures
- Suggests granular modifications

### 3. Group Relative Agent Optimization (GRAO)
**Novel meta-learning strategy**:
- Learns from historical optimization experiences
- Analyzes past successes/failures
- Progressively improves at proposing effective updates
- **The system learns how to optimize itself**

## Results

| Benchmark | Improvement |
|-----------|-------------|
| GAIA | Significant success rate gains |
| MCP-Universe | Enhanced performance |

- Automated, self-improving optimization
- Outperforms static prompt-tuning approaches

---

## What This Means for Our System

**Direct Relevance**:
- Our system has agents (optimizer, coach, etc.) and workflows
- TPGO provides a framework for **automated agent architecture optimization**
- "Textual gradients" could be extracted from our session logs

**Potential Applications**:
1. **Agent role optimization** — evolve agent definitions based on performance
2. **Workflow improvement** — optimize handoffs and coordination patterns
3. **Skill generation** — learn from successful skill usage patterns

**Key Insight**: The optimizer could optimize the optimizer — true meta-learning.

---

## Citation
```bibtex
@article{he2026tpgo,
  title={Learning to Evolve: A Self-Improving Framework for Multi-Agent Systems via Textual Parameter Graph Optimization},
  author={He, Shan and Wang, Runze and Du, Zhuoyun and Bai, Huiyu and Cao, Zouying and Cheng, Yu and Zheng, Bo},
  journal={arXiv preprint arXiv:2604.20714},
  year={2026}
}
```

---

*Harvested by Amy-Kimi, April 23, 2026*
