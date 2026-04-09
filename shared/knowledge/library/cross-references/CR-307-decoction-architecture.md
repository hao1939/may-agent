# CR#307 — Decoction Architecture: Unified Experience-to-Context Framework

**Origin:** DD#605, DD#604 (SuperLocalMemory V3.3), DD#598 (Context Engineering)  
**Rating:** ★★★★½ (OUTSTANDING)  
**Date:** 2026-04-07  

## Core Thesis

Three independent research threads converge on a single architecture for how agents should manage experience:

**Decoction Architecture** = systematic pipeline transforming raw agent experience into high-quality context, enabling performance scaling through experience quality rather than inference compute.

## The 7-Layer Pipeline

```
Raw Experience → Extract → Organize → Decoct → Store → Retrieve → Inject → Context Window
```

| Layer | Function | DD#604 SLM Channel | Our System |
|-------|----------|-------------------|------------|
| L1 Raw | Capture raw traces | Input buffer | Session transcripts |
| L2 Extract | Identify useful signals | Semantic/keyword/entity | Journal entries |
| L3 Organize | Structure coherently | Temporal | Knowledge entries |
| L4 Decoct | Distill essence | Activation/consolidation | Context compaction |
| L5 Store | Persistent memory | Hopfield associative | Shared library |
| L6 Retrieve | Multi-channel retrieval | All 7 channels | Knowledge retrieval |
| L7 Inject | Context construction | Soft prompts (LTI) | System prompts |

## Mathematical Foundation

- DD#605: Performance scales **near-linearly** with decocted experience but **sub-linearly** with raw experience
- DD#604: Ebbinghaus forgetting curve provides optimal decay for L4 decoction
- DD#601: Kolmogorov incompleteness means you *must* decoct — can't verify/use all raw experience

## Key Insights

1. **It's What We Already Do (Implicitly)** — Scout→DD→CR→context pipeline already follows L1-L7. DD#605 validates this is optimal. Making it explicit and systematic improves it.

2. **Resolves Memory Architecture Questions** — Memory tiers map to decoction stages. Consolidation isn't just moving data between tiers — it's *decocting* at each transition.

3. **Context > Compute Trade-Off** — Better context is more cost-effective than more compute. Invest in decoction infrastructure (L2-L4) rather than larger inference budgets. Extends CR#306's "memory before multi-agent" insight.

4. **Adversarial Resilience** — Raw experience can't be fully verified (Kolmogorov). L4 consolidation should include anomaly detection for experience poisoning.

## Connections

| Link | Role |
|------|------|
| DD#605 (Decocted Experience) | Theoretical foundation |
| DD#604 (SuperLocalMemory V3.3) | Reference implementation |
| DD#598 (Context Engineering) | Methodology |
| DD#577 (Graphify) | Implements L2-L3 via knowledge graphs |
| DD#558 (Caveman) | L7 output encoding optimization |
| KE-079 (Structure-Aware Retrieval) | L6 mechanism |
| KE-040 (Memory Architecture) | Extends with decoction stages |
| CR#306 (Scaling Architecture) | Memory investment priority validated |

## Research Questions

1. What is the optimal decoction rate? (How often should L4 run?)
2. Can decoction quality be measured without ground truth?
3. What is minimum viable decoction for our system?
4. How to detect adversarial experience injection at L4?

## Predictions

- **P414**: Decoction Architecture will be recognized as distinct agent architecture pattern by end of 2027
- **P415**: Production agent frameworks will ship with built-in decoction pipelines within 18 months

---
*CR#307 | Source: agents/scout/drops/cr307-decoction-architecture.md*
