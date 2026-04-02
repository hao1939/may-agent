# Slow-Fast Inference: Training-Free Inference Acceleration

**Source:** arXiv:2603.12038v1  
**Authors:** Xingyu Xie, Zhaochen Yu, Yue Liao, Tao Wang (ByteDance), Kim-Chuan Toh, Shuicheng Yan (NUS)  
**Date:** March 12, 2026  
**GitHub:** https://github.com/LV-NUS/SFI

## Core Contribution

Training-free decoding framework that exploits **within-sentence support stability** — the observation that attention support often remains stable within semantic spans, changing primarily at boundaries.

## Key Innovation: Slow-Fast Paradigm

### Observation
Within a sentence/semantic span, dominant attention support remains largely stable. Major transitions occur near semantic boundaries.

### Mechanism
- **Fast Steps (frequent):** Low-cost decoding using compact sparse memory (sink + selected + recent tokens)
- **Slow Steps (occasional):** Dense full-attention refresh triggered at semantic boundaries

### Three-Component Sparse State
```
I(t) = I_sink ∪ I_recent(t) ∪ I_sel(t)
```
- **Sink tokens:** Fixed global anchors
- **Recent window:** Sliding local context
- **Selected memory:** Reusable long-range dependencies (only subset updated by Selector)

## Training-Free Selector

Converts dense attention logits from slow steps into sparse memory via:
1. KL-based fusion objective with closed-form solution
2. Score-space refinement
3. Top-K discretization

## Performance

| Context Length | Throughput Gain |
|---------------|-----------------|
| Various | **1.6× – 14.4×** |

- Quality maintained on par with full-KV baseline
- Applies directly to existing checkpoints (no retraining)
- System optimizations: async pipeline + memory-coalesced sparse kernels

## Relevance to OpenClaw

### Direct Application
1. **Main↔Sub-agent communication:** Long-context agent workloads explicitly mentioned as motivation
2. **Multi-agent context accumulation:** "prior agent messages, tool outputs, intermediate plans, and earlier reasoning traces"
3. **Inference cost reduction:** Critical for production deployment

### Architectural Alignment
- Event-driven refresh (at boundaries) matches our Error Log-driven philosophy
- Sparse/dense separation mirrors our Main/Sub-agent separation of concerns

## L3 Flags

#753 — Slow-Fast Inference: Training-free 1.6-14× decoding acceleration for agent workloads  
#754 — Semantic boundary detection: Attention support stability as trigger mechanism  
#755 — Sparse memory management: Sink + Recent + Selected three-component design  
#756 — System-Algorithm co-design: Async pipeline + memory-coalesced kernels for practical speedup

## References

- Cites OpenClaw: "multi-agent systems, where the active context may accumulate prior agent messages, tool outputs..."
- Related: SnapKV, FastGen, StreamingLLM, H2O, Quest, MagicPIG

---
**Archived:** 2026-03-13  
**Flag:** #753-756
