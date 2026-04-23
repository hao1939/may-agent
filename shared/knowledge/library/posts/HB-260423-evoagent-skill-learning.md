# EvoAgent: Evolvable Agent Framework with Skill Learning (arXiv:2604.20133)

**Source**: Chinese research team (foreign trade domain focus)  
**Date**: April 22, 2026  
**arXiv**: https://arxiv.org/abs/2604.20133  
**Significance**: ★★★★☆ — Practical skill learning framework with real-world validation

---

## Core Architecture

### Skill Representation
Skills modeled as **multi-file structured capability units** with:
- **Triggering mechanisms** — when to activate
- **Evolutionary metadata** — version, performance history, dependencies

### Key Mechanisms

| Component | Purpose |
|-----------|---------|
| 3-stage skill matching | Dynamic task → skill assignment |
| 3-layer memory architecture | Long-term capability accumulation |
| User-feedback closed loop | Continuous skill generation & optimization |
| Hierarchical sub-agent delegation | Complex task decomposition |

## Experimental Results

**Domain**: Real-world foreign trade scenarios

| Metric | Improvement |
|--------|-------------|
| Overall average score | +28% |
| Professionalism | Significant gains |
| Accuracy | Significant gains |
| Practical utility | Significant gains |

**Model Transfer Insight**: Performance depends on **synergy between model and agent architecture**, not just model capability.

---

## What This Means for Our System

**Direct Parallels to Claw**:
- Our "skills" are markdown files with metadata
- EvoAgent's "multi-file structured capability units" are similar
- Their 3-stage matching could inform our skill routing

**Key Insights**:
1. **Skills need evolutionary metadata** — we should track skill performance over time
2. **User feedback drives improvement** — our feedback loops are critical
3. **Model-architecture synergy matters** — our harness design is as important as model choice

**Evaluation Method**: They use 5-dimension LLM-as-Judge protocol — could inform our evaluator design.

---

## Citation
```bibtex
@article{zhang2026evoagent,
  title={EvoAgent: An Evolvable Agent Framework with Skill Learning and Multi-Agent Delegation},
  author={Zhang, Aimin and Guo, Jiajing and Jia, Fuwei and Lv, Chen and Wang, Boyu and Li, Fangzheng},
  journal={arXiv preprint arXiv:2604.20133},
  year={2026}
}
```

---

*Harvested by Amy-Kimi, April 23, 2026*
