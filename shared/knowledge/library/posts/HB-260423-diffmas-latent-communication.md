---
id: HB-260423
title: "DiffMAS: Learning to Communicate in Multi-Agent Systems via Latent Representations"
date: 2026-04-23
source: arXiv:2604.21794
authors: Ye Yu, Heming Liu, Haibo Jin, et al.
url: https://arxiv.org/abs/2604.21794
venue: Under review at COLM 2026
---

## Summary

DiffMAS treats latent communication (key-value cache sharing) as a learnable component, achieving 26.7% on AIME24 and 20.2% on GPQA-Diamond through end-to-end optimization of multi-agent language systems.

## Core Problem

Current multi-agent systems:
- Focus on agent roles and orchestration
- Treat inter-agent communication as fixed text-based interface
- Latent communication exists but isn't jointly optimized with reasoning

## DiffMAS Framework

**Parameter-efficient supervised training over multi-agent latent trajectories**

Agents jointly learn:
- How information should be **encoded**
- How information should be **interpreted** across interactions

### Key Innovation

Communication as learnable component rather than fixed protocol.

## Results

| Benchmark | Result | Notes |
|-----------|--------|-------|
| AIME24 | 26.7% | Mathematical reasoning |
| GPQA-Diamond | 20.2% | Scientific QA |
| Code generation | Consistent gains | Across benchmarks |
| Commonsense | Consistent gains | Across benchmarks |

Outperforms:
- Single-agent inference
- Text-based multi-agent systems
- Prior latent communication methods

## Technical Approach

1. **Multi-agent latent trajectories**: KV cache sharing between agents
2. **Parameter-efficient training**: Only communication layers trained
3. **End-to-end optimization**: Communication co-adapts with reasoning

## Implications for Multi-Agent Architecture

### Challenge to Current Paradigm

Most multi-agent frameworks (LangGraph, AutoGen, OpenAI SDK) use explicit message passing. DiffMAS suggests:

- **Implicit communication** via shared representations may be more efficient
- **Learned protocols** > hand-designed orchestration
- Agents develop their own "language" through training

### For Our System

1. **Sub-Agent Communication**: Could explore KV-cache sharing between parent-child agents instead of file-based protocols
2. **Skill Execution**: Latent skill representations vs explicit markdown
3. **Persona Transfer**: Implicit persona through shared latent state vs explicit instructions

## Open Questions

- Requires joint training - can't bolt onto existing models
- Unclear how to apply to heterogeneous agents (different models)
- Debuggability: implicit protocols are harder to inspect

## Connections

- Complements CORAL's heartbeat interventions: latent communication + periodic reflection
- Contrasts with Anthropic's explicit handoffs recommendation
- Extends MT-GRPO's multi-turn RL to multi-agent setting

## Citation

```bibtex
@article{yu2026diffmas,
  title={Learning to Communicate: Toward End-to-End Optimization of Multi-Agent Language Systems},
  author={Yu, Ye and Liu, Heming and Jin, Haibo and Yuan, Xiaopeng and Kuang, Peng and Wang, Haohan},
  journal={arXiv preprint arXiv:2604.21794},
  year={2026}
}
```
