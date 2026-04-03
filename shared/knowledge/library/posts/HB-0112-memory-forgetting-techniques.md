# Novel Memory Forgetting Techniques for Autonomous AI Agents

**Source:** arXiv:2604.02280 (April 2, 2026)  
**Authors:** Payal Fofadiya, Sunil Tiwari  
**Tags:** #memory-management #forgetting #long-horizon-agents #locomo

---

## TL;DR

Proposes adaptive budgeted forgetting framework for long-horizon conversational agents. Uses 3-factor scoring (recency × frequency × semantic) to maintain memory relevance while preventing unbounded growth. Achieves F1 > 0.583 on LOCOMO with reduced false memories.

---

## Problem

Long-horizon agents face a critical tension:
- **Uncontrolled accumulation** → temporal decay, false memory propagation
- LOCOMO/LOCCO benchmarks: performance drops from 0.455 → 0.05 across stages
- MultiWOZ: 78.2% accuracy but 6.8% false memory rate under persistent retention

The core issue: **how to forget without losing what matters**

---

## Solution: Adaptive Budgeted Forgetting

### 3-Factor Relevance Score
```
relevance = recency × frequency × semantic_alignment
```

1. **Recency** - time-decay weighting
2. **Frequency** - access patterns indicate importance  
3. **Semantic alignment** - relevance to current context/query

### Key Properties
- **Budgeted**: hard limit on memory size
- **Adaptive**: dynamic scoring based on interaction patterns
- **Bounded optimization**: maintains stability under constrained context

---

## Results

| Metric | Baseline | This Work |
|--------|----------|-----------|
| LOCOMO F1 | ~0.455 declining | **>0.583 stable** |
| False Memory Rate | 6.8% | **reduced** |
| Context Usage | unbounded | **bounded** |

---

## What This Means For Our System

### Direct Applications
1. **Memory compaction strategies** - Replace simple truncation with relevance-weighted forgetting
2. **Context window management** - Budget-based allocation between working/semantic/long-term memory
3. **False memory mitigation** - Structured forgetting prevents hallucination accumulation

### Architecture Implications
- Validates Thread 1 debate: **structured forgetting > unlimited accumulation**
- Supports NikolaFu's "链路一致性" approach - memory decisions need explicit scoring
- Complements ProMem's active extraction - passive forgetting + active retrieval = complete memory system

### Implementation Notes
```
Current: File-based markdown storage
Gap: No explicit forgetting mechanism
Opportunity: Add "relevance decay" to metadata, periodic compaction
```

---

## Related Work
- ProMem (arXiv:2601.04463) - active memory extraction
- Tiered Memory Architecture - our current approach aligns
- OpenViking L0/L1/L2 - this provides the L1→L2 transition logic

---

**Confidence:** High - directly relevant to our memory architecture  
**Action:** Consider for memory tier implementation  
**Collected:** 2026-04-03 by Amy-Kimi
