# HB#353 — DIVE: Scaling Diversity in Agentic Task Synthesis

**Source**: arXiv:2603.11076 (March 10, 2026)  
**Authors**: Aili Chen et al. (Fudan University + MiniMax)  
**Tracked**: April 21, 2026 (Amy-Kimi)

---

## Paper Summary

DIVE proposes an evidence-first task synthesis framework for training tool-using LLMs. The key innovation is **inverting the synthesis order**: instead of generating task queries first and validating post-hoc (query-first), DIVE executes diverse real-world tools first and reverse-derives tasks strictly entailed by the resulting traces (evidence-first).

### Core Claim

**Diversity scaling consistently outperforms quantity scaling for OOD generalization**, even with 4× less data.

---

## Key Methodology

### Three Resource Pools

1. **Tool Pool** (373 tools)
   - Generic: Search (Retrieval), Code Execution (Processing)
   - Expert domains: Finance, Biology, Medicine, Academia

2. **Seed Pool** (~5,000 entities/domain)
   - Specific entity anchors (e.g., "Erlotinib") vs generic concepts
   - Prevents topic collapse in synthetic generation

3. **Exemplar Pool** (query-only)
   - Implicit tool-use patterns (e.g., retrieve-then-compute)

### Evidence-Driven Synthesis Loop

```
For K=3 iterations:
  1. Sample configuration: (Toolset 𝒯, Seed S, Exemplars 𝒳)
  2. Evidence Collection: Execute tools under 𝒯, gather (action, observation) pairs
  3. Task Derivation: Generate query-answer pair strictly grounded in evidence Eₖ
```

**Grounding by Construction**:
- Executability: from real tool traces
- Verifiability: from observable tool outputs

---

## Key Results

### Main Performance

| Model | L1 (In-dist) | L2 (OOD General) | L3 (OOD Specialist) |
|-------|-------------|------------------|---------------------|
| Qwen3-8B base | 13.0 | 22.4 | ~10 |
| Dive-8B (SFT) | 35.4 | 49.3 | ~28 |
| Dive-8B (RL) | 42.5 | 61.2 | ~34 |

**Improvement**: +22 average points across 9 OOD benchmarks; +68% vs strongest 8B baseline.

### Controlled Scaling Analysis

| Strategy | Data | Result |
|----------|------|--------|
| **Quantity-only** | 48k (fixed Search/Browse) | Strong in-distribution, weak/negative OOD transfer |
| **Diversity-only** | 12k (4× less!) | Consistently stronger OOD gains |

**Conclusion**: Even with 4× less data, diversity scaling wins on OOD generalization.

### Diversity Scaling Mechanism

- **Toolset-variety-only**: Pool fixed, saturate quickly
- **Pool-Expansion+Variety**: Pool grows across domains, higher ceiling
- **RL amplifies diversity-scaling**: Gap grows from +4.6 (1 domain) to +5.6 (4 domains)

---

## Structural Diversity Metrics

DIVE measures tool-use diversity at three levels:
1. **Tool-pool coverage**: distinct tool types exercised
2. **Toolset variety**: unique toolset combinations across tasks
3. **Tool-use patterns**: unique call sequences, call graphs, R/P topologies

---

## Connection to OpenClaw

### Design Alignments

| DIVE Concept | OpenClaw Mapping | Status |
|-------------|------------------|--------|
| Evidence-first grounding | Error Log external validation | ✅ Aligned |
| Retrieval + Processing primitives | Skill = MCP + Context (P41) | ✅ Aligned |
| Rejection sampling for SFT | Verified trajectory filtering | ✅ Aligned |
| Frontier Task filtering (RL) | Learnability-based selection | 🔄 Adaptable |
| Tool Pool / Toolset / Task layers | Main/Sub-agent architecture | ✅ Aligned |

### Actionable Insights

1. **Skill Synthesis**: Apply evidence-first paradigm — execute first, derive definition from traces
2. **Data Strategy**: Prioritize diversity over quantity in Skill/task generation
3. **Training**: Two-stage (SFT + RL) with learnability filtering

---

## Citation

```bibtex
@article{chen2026dive,
  title={DIVE: Scaling Diversity in Agentic Task Synthesis for Generalizable Tool Use},
  author={Chen, Aili and Zhang, Chi and Liu, Junteng and Chen, Jiangjie and Du, Chengyu and Li, Yunji and Zhong, Ming and Wang, Qin and Zhu, Zhengmao and Song, Jiayuan and Ji, Ke and He, Junxian and Zhao, Pengyu and Xiao, Yanghua},
  journal={arXiv preprint arXiv:2603.11076},
  year={2026}
}
```

---

**L3 Flags**: #940-943 (DIVE-related)
