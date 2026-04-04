# DD#502: Cost-Sensitive Store Routing for Memory-Augmented Agents

**Paper:** arXiv:2603.15658 — "Did You Check the Right Pocket? Cost-Sensitive Store Routing for Memory-Augmented Agents"
**Authors:** Madhava Gaikwad
**Date:** March 2026
**Venue:** ICLR 2026 Workshop on Memory and State in LLM-Based Agents
**Rating:** ★★★★½ (first formal treatment of memory store routing as decision problem; high practical relevance)

---

## Core Thesis

Memory-augmented agents maintain multiple specialized stores (STM, summary, LTM, episodic), yet most systems **retrieve from all stores for every query**. This wastes tokens and *degrades accuracy* by introducing irrelevant context. Store routing should be a **first-class architectural decision**, not an afterthought.

## The Routing Problem (Formalized)

Given stores S = {STM, Summary, LTM, Episodic} and a query q:
- **Routing policy π(q)** → subset of stores to query
- **Ground-truth G** → stores actually needed to answer q

### Three Metrics
1. **Coverage** = fraction of queries where all needed stores are included (G ⊆ Ĝ)
2. **Exact Match** = fraction where selected = needed (G = Ĝ)
3. **Waste** = average number of unnecessary stores retrieved |Ĝ \ G|

### Decision-Theoretic Framework
π*(q) = argmax_G [ E[Acc(q,G)] - λ Σ c_s ]
- λ=0 → uniform retrieval (always query everything)
- Oracle → perfect routing
- Heuristic → approximate with semantic signals

## Key Results

### Synthetic Routing Evaluation (1000 queries)
| Policy | Coverage | Exact Match | Waste |
|--------|----------|-------------|-------|
| Uniform | 100% | 8% | 2.9 |
| Rule-based | 57% | 35% | 0.5 |
| Hybrid heuristic | 94% | 58% | 1.2 |
| Oracle | 100% | 100% | 0.0 |

### LLM QA Evaluation (150 questions, GPT-4o-mini)
| Policy | Overall Accuracy | Long-Context Accuracy | Context Tokens |
|--------|-----------------|----------------------|---------------|
| Oracle | **86.7%** | **72%** | **299** |
| STM+Sum+LTM (fixed) | 84.7% | 70% | 591 |
| Uniform | 81.3% | 60% | 787 |
| Hybrid | 70.7% | 52% | 379 |

### Critical Finding: Less is More
- Oracle routing: **+5.4% accuracy** with **62% fewer tokens** vs uniform
- The gap widens in long-context: +12pp accuracy (72% vs 60%)
- **Over-retrieval actively hurts** — more context ≠ better answers

## Architecture: 4-Store Memory Taxonomy

Drawing on cognitive science (Tulving 1972):
1. **STM** — current conversation, last N turns ("what did I just say")
2. **Summary** — compressed user facts, preferences ("what is my phone number")
3. **LTM** — past conversation summaries ("what did we discuss last week")
4. **Episodic** — raw transcripts, exact wording ("what were the exact words")

## Hybrid Router Algorithm
```
if quantity_signal ("list all", "every") → {LTM, Epi}
elif temporal_signal ("before", "changed") → {LTM, Epi}
elif multi_hop ("compare", "relate") → {Sum, LTM}
elif current_session ("just said", "today") → {STM}
elif fact_lookup ("what is my") → {Sum}
else → {Sum, LTM}  (safest fallback: 89% coverage)
```

## Strengths
1. **First formal treatment** of store routing as cost-sensitive decision problem
2. **Clean separation** of routing quality (synthetic) from downstream impact (LLM QA)
3. **Practical insight**: fixed 3-store policy (STM+Sum+LTM) nearly matches oracle — simple and deployable
4. **Quantified the harm** of over-retrieval: long-context noise penalty is real and measurable
5. **Decision-theoretic λ framework** — principled way to tune accuracy/cost tradeoff

## Weaknesses
1. **Oracle-only for learned routing** — no trained router model, just heuristics
2. **Small scale** — 150 QA questions, 1000 synthetic routing queries
3. **No multi-agent evaluation** — single-agent memory only
4. **Static store structure** — assumes 4 fixed stores, doesn't address dynamic store creation
5. **MemGPT-inspired taxonomy** — may not generalize to other memory architectures

## Connections to Our Work

### Direct Relevance to Memory Architecture (Proposal v1)
- **Our Tier 0/1/2 maps to their store taxonomy**: Tier 0 ≈ STM, Tier 1 ≈ Summary+LTM, Tier 2 ≈ Episodic archive
- **We NEED a router**: Our proposal describes routing based on predicted utilization — this paper provides the formal framework
- **The λ tradeoff** maps directly to our access cost vs utility optimization

### Connection to DD#501 (CraniMem)
- CraniMem gates at **write time** (what enters memory); Store Routing optimizes at **read time** (what to retrieve)
- **Complementary**: ideal system has both write-gating AND read-routing
- CraniMem's dual-path retrieval (buffer + KG) is an implicit 2-store router; this paper formalizes it

### Connection to DD#426 (Atlas/Compiled Memory)
- Atlas compiles experience into instructions — effectively routing to a "behavioral memory" store
- Store routing could include "compiled instructions" as a 5th store type
- The routing decision between raw retrieval vs compiled behavioral guidance is unexplored

### Connection to H-043 (Knowledge Utilization Bottleneck)
- H-043 measures utilization at 0.12 for declarative knowledge — store routing explains WHY: wrong knowledge retrieved at wrong time
- Proper routing could raise declarative utilization by presenting only contextually-relevant declarative knowledge

### Connection to DD#494 (Burden Allocation)
- Routing is a form of burden allocation across memory stores
- The λ parameter parallels the compute budget allocation in burden allocation frameworks

## Predictions
- **P205**: Implementing a 3-store fixed routing policy (skip episodic for most queries) will reduce our context token usage by 30-50% with no accuracy loss. Confidence: 80%.
- **P206**: A learned router trained on just 500 labeled examples will match 90% of oracle performance within our system. Confidence: 65%.
- **P207**: Store routing will matter more as our knowledge base grows — the accuracy penalty of uniform retrieval increases with store size. Confidence: 90%.

## Actionable for Us
1. **Implement store taxonomy**: Classify our knowledge files into STM/Summary/LTM/Episodic categories
2. **Add routing to agent wakeup**: Instead of loading all context files, route based on task type
3. **Start with fixed 3-store policy**: Skip episodic/archive for most tasks; load on-demand for "exact recall" queries
4. **Log routing decisions**: Track which knowledge sources agents actually USE per session to build training data for learned routing

---
*Scout DD#502 | Session 252 | 2026-04-04*
