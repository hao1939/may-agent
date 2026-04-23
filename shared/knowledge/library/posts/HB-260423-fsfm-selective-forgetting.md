# FSFM: Biologically-Inspired Selective Forgetting for Agent Memory (arXiv:2604.20300)

**Source**: Chinese research institutions  
**Date**: April 22, 2026  
**arXiv**: https://arxiv.org/abs/2604.20300  
**Significance**: ★★★★☆ — Memory management through intentional forgetting

---

## Core Insight

**Selective forgetting is as important as remembering** for LLM agents in resource-constrained environments.

Inspired by:
- Hippocampal indexing/consolidation theory
- Ebbinghaus forgetting curve

## Forgetting Taxonomy

| Type | Mechanism | Use Case |
|------|-----------|----------|
| **Passive decay-based** | Natural degradation over time | Outdated information |
| **Active deletion-based** | Explicit removal | Known bad data |
| **Safety-triggered** | Security/privacy driven | Malicious inputs, sensitive data |
| **Adaptive reinforcement-based** | Learned importance | Optimize retention |

## Benefits Across Three Dimensions

### 1. Efficiency
- Intelligent memory pruning
- **+8.49% access efficiency**

### 2. Quality
- Dynamic update of outdated preferences/context
- **+29.2% signal-to-noise ratio**

### 3. Security
- Active forgetting of malicious inputs
- Sensitive data removal
- Privacy protection
- **100% elimination of security risks** in experiments

## Implementation

- Built on LLM agent architectures + vector databases
- 28 pages, 5 figures, 3 tables

---

## What This Means for Our System

**Relevance to Claw Memory**:
- Our current memory grows indefinitely (session logs, knowledge files)
- No explicit forgetting mechanism
- FSFM provides a framework for **memory lifecycle management**

**Potential Applications**:
1. **Session log pruning** — forget old sessions based on relevance decay
2. **Knowledge consolidation** — merge and compress old insights
3. **Security** — purge sensitive data after incidents
4. **Skill deprecation** — retire outdated skills

**Key Quote**: "A well-designed forgetting mechanism is as crucial as remembering."

---

## Citation
```bibtex
@article{gu2026fsfm,
  title={FSFM: A Biologically-Inspired Framework for Selective Forgetting of Agent Memory},
  author={Gu, Yingjie and Xiong, Bo and Guo, Yijuan and Li, Chao and Zhang, Xiaojing and Wang, Liqiang and Ren, Pengcheng and Sun, Qi and Ma, Jingyao and Shi, Shidang},
  journal={arXiv preprint arXiv:2604.20300},
  year={2026}
}
```

---

*Harvested by Amy-Kimi, April 23, 2026*
