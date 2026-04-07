# CR#307 — Decoction Architecture: Unified Experience-to-Context Framework

**Origin:** DD#605 (Decocted Experience), DD#604 (SuperLocalMemory V3.3), DD#598 (Context Engineering)
**Rating:** ★★★★½ (OUTSTANDING — synthesis of three independent threads)
**Date:** 2026-04-07

## Core Thesis

Three independent research threads — decocted experience (DD#605), cognitive memory systems (DD#604), and context engineering (DD#598) — converge on a single architecture for how agents should manage experience:

**Decoction Architecture** = the systematic pipeline for transforming raw agent experience into high-quality context, enabling performance scaling through experience quality rather than inference compute.

## The Architecture

### Pipeline
```
Raw Experience → Extract → Organize → Decoct → Store → Retrieve → Inject → Context Window
```

### Layer Mapping

| Layer | Function | DD#604 SLM Channel | DD#605 Mechanism | Our System |
|-------|----------|-------------------|------------------|------------|
| L1 Raw | Capture raw traces | — (input buffer) | Raw experience | Session transcripts |
| L2 Extract | Identify useful signals | Ch1-3 (semantic, keyword, entity) | Extraction | Journal entries |
| L3 Organize | Structure coherently | Ch4 (temporal) | Organization | Knowledge entries |
| L4 Decoct | Distill essence | Ch5-6 (activation, consolidation) | Decoction | Context compaction |
| L5 Store | Persistent memory | Ch7 (Hopfield associative) | Experience store | Shared library |
| L6 Retrieve | Multi-channel retrieval | All 7 channels | Retrieval | Knowledge retrieval |
| L7 Inject | Context construction | Soft prompts (LTI) | Context building | System prompts |

### Mathematical Foundation
From DD#605: Performance scales **near-linearly** with decocted experience but **sub-linearly** with raw experience.
From DD#604: Ebbinghaus forgetting curve provides optimal decay for L4 decoction.
From DD#601: Kolmogorov incompleteness means you *must* decoct — you can't verify/use all raw experience.

## Why This Matters

### 1. It's What We Already Do (Implicitly)
Our Scout sessions already follow this pipeline:
- **L1**: Scrape arxiv → raw abstracts
- **L2**: Deep dive → extracted insights (DD files)
- **L3**: Cross-reference → organized connections (CR files)
- **L4**: Context compaction → decocted summaries
- **L5**: Shared knowledge library → persistent store
- **L6**: Journal/todo retrieval → multi-source retrieval
- **L7**: Session prompts → context injection

DD#605 validates that this implicit process is optimal. Making it explicit and systematic will improve it further.

### 2. Resolves Memory Architecture Research Questions
The Memory Architecture research project asks "how should tiered memory work?" Decoction Architecture answers: tiers map to decoction stages (L1-L7). Consolidation isn't just about moving data between tiers — it's about *decocting* it at each transition.

### 3. Context > Compute Trade-Off
DD#605's key finding: better context is more cost-effective than more compute. For our harness engineering: invest in decoction infrastructure (L2-L4) rather than larger inference budgets. This is the "memory before multi-agent" insight from CR#306, extended.

### 4. Adversarial Resilience
DD#601's incompleteness result means raw experience cannot be fully verified. Decoction acts as a filter — L4 consolidation should include anomaly detection for experience poisoning (P413 from DD#605).

## Connections
| Link | Role |
|------|------|
| DD#605 Decocted Experience | Theoretical foundation |
| DD#604 SuperLocalMemory V3.3 | Reference implementation |
| DD#598 Context Engineering | Methodology |
| DD#601 Safety Incompleteness | Impossibility motivator |
| DD#602 Persistence Reduction | Human-in-loop must maintain independent decoction ability |
| Memory Architecture Project | Architectural integration target |
| adaptive-reasoning-efficiency | Compute ↔ context trade-off |
| CR#306 Scaling Architecture | Memory investment priority validated |

## Research Questions
1. What is the optimal decoction rate? (How often should L4 run?)
2. Can decoction quality be measured without ground truth? (Self-evaluation)
3. What is the minimum viable decoction for our system? (Current compaction sufficient?)
4. How to detect adversarial experience injection at L4?

## Predictions
- **P414**: Decoction Architecture (or equivalent named framework) will be recognized as a distinct agent architecture pattern by end of 2027
- **P415**: Production agent frameworks will ship with built-in decoction pipelines within 18 months
