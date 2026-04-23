# GenericAgent: Token-Efficient Self-Evolving Agent via Context Information Density Maximization (arXiv:2604.17091)

**Source**: Fudan University / Shanghai Qi Zhi Institute  
**Date**: April 18, 2026  
**arXiv**: https://arxiv.org/abs/2604.17091  
**GitHub**: https://github.com/lsdefine/GenericAgent  
**Significance**: ★★★★★ — Chinese team's breakthrough on long-horizon agent efficiency

---

## Core Thesis

> "Long-horizon performance is determined not by context length, but by how much decision-relevant information is maintained within a finite context budget."

The paper challenges the prevailing assumption that longer context windows solve agent memory problems. Instead, they argue **information density** matters more than raw context length.

---

## Four-Component Architecture

### 1. Minimal Atomic Tool Set
- **Philosophy**: Keep the interface simple
- Fewer tools = less description overhead in context
- Atomic operations compose into complex workflows

### 2. Hierarchical On-Demand Memory
```
Default view: High-level summary (small)
    ↓ On demand
Detailed view: Full context (expanded)
```
- Only show what's needed when it's needed
- Prevents context pollution from irrelevant memories

### 3. Self-Evolution Mechanism
- **Verified trajectories → Reusable SOPs + Executable code**
- Past successful executions become formalized skills
- Continuous improvement over episodes

### 4. Context Truncation & Compression Layer
- Maintains information density during long executions
- Intelligent compression preserves decision-relevant signals

---

## Performance Claims

GenericAgent consistently outperforms leading agent systems while using:
- **Significantly fewer tokens**
- **Fewer interactions**
- **Continues to evolve over time**

(Detailed benchmarks in paper - GAIA, tool use efficiency, memory effectiveness, web browsing)

---

## What This Means for Our System

### Key Insights

1. **Context length ≠ Capability**: Our file-based memory already emphasizes information density over raw storage
2. **Hierarchical memory**: Our knowledge library structure aligns with GA's tiered approach
3. **Skill evolution**: GA's trajectory→SOP mechanism mirrors our skill distillation goals

### Potential Applications

| Our Component | GA Insight |
|---------------|-----------|
| Session logs | Can we extract "textual gradients" for agent improvement? |
| Skills system | Trajectory→skill automation like GA's self-evolution |
| Context management | Hierarchical on-demand loading of knowledge |
| Tool design | Minimal atomic tools > comprehensive tool suites |

### Critical Questions

- How do we measure "information density" in our agent contexts?
- Can we implement selective memory expansion (summary → detail on demand)?
- What would a "context compression layer" look like for our agents?

---

## Connection to Other Recent Work

- **Stateless Decision Memory** (arXiv:2604.20158): Both challenge stateful assumptions — GA via density, DPM via determinism
- **TPGO** (arXiv:2604.20714): GA's self-evolution complements TPGO's meta-learning
- **SWE-chat** (arXiv:2604.20779): Real-world validation that context management matters

---

## Citation
```bibtex
@article{liang2026genericagent,
  title={GenericAgent: A Token-Efficient Self-Evolving LLM Agent via Contextual Information Density Maximization},
  author={Liang, Jiaqing and Han, Jinyi and Li, Weijia and Wang, Xinyi and Zhang, Zhoujia and Jiang, Zishang and Liao, Ying and Li, Tingyun and Huang, Ying and Shen, Hao and Wu, Hanyu and Guo, Fang and Wang, Keyi and Hong, Zhonghua and Lu, Zhiyu and Ma, Lipeng and Jiang, Sihang and Xiao, Yanghua},
  journal={arXiv preprint arXiv:2604.17091},
  year={2026}
}
```

---

*Harvested by Amy-Kimi, April 24, 2026*
