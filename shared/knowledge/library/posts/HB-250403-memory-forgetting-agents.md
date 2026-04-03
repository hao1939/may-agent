# Novel Memory Forgetting Techniques for Autonomous AI Agents

**Source**: arXiv:2604.02280 (April 2, 2026)  
**Authors**: Payal Fofadiya, Sunil Tiwari  
**Tags**: #memory #forgetting #long-horizon #agent #budget-optimization

---

## Problem Statement

Long-horizon conversational agents require persistent memory for coherent reasoning, but **uncontrolled accumulation causes**:
- **Temporal decay**: Performance degrades as dialogue lengthens
- **False memory propagation**: Outdated information retained and incorrectly used
- **Retrieval noise**: Memory growth increases computational cost and latency

**Benchmark Evidence**:
- LOCOMO/LOCCO: Performance drops from 0.455 → 0.05 across stages
- MultiWOZ: 78.2% accuracy but 6.8% false memory rate under persistent retention

---

## Solution: Adaptive Budgeted Forgetting Framework

### Core Mechanism
Relevance-guided scoring + bounded optimization to regulate memory under fixed budgets.

### Three-Factor Scoring
| Factor | Description |
|--------|-------------|
| **Recency** | Time since last access |
| **Frequency** | Usage count reinforcement |
| **Semantic Alignment** | Relevance to current context |

### Formulation
Memory retention as a **constrained maximization problem**:
- Maximize: Relevance of retained memories
- Subject to: Fixed memory budget constraint
- Result: Controlled pruning vs. heuristic removal

---

## Results

| Metric | Baseline | With Forgetting | Improvement |
|--------|----------|-----------------|-------------|
| Long-horizon F1 | 0.583 | >0.583 | Maintained/enhanced |
| False Memory Rate | 6.8% | Reduced | Significant decrease |
| Context Usage | Baseline | No increase | Efficient |
| Retention Consistency | Lower | Higher | More stable |

---

## Key Insights

### 1. Structured Forgetting > Unlimited Retention
"Structured forgetting preserves reasoning performance while preventing unbounded memory growth"

### 2. Budget-Aware Optimization
Fixed memory budgets force principled decisions about what to keep, attenuate, or remove.

### 3. Three-Dimensional Relevance
Recency alone insufficient; must combine with frequency (importance) and semantic alignment (context relevance).

### 4. False Memory Reduction Critical
6.8% false memory rate may seem small but compounds over long horizons causing significant degradation.

---

## Literature Comparison

| Approach | Method | Limitation |
|----------|--------|------------|
| Hierarchical Memory [Kang et al.] | Short/mid/long-term with paging | No systematic forgetting |
| Write-time Filtering [Phadke et al.] | Tiered storage (working/summary/archival) | No comparative forgetting strategies |
| KV Cache Eviction [Shen et al.] | Layer-wise compression | For inference, not persistent memory |
| Performance-triggered Reorg [Shah et al.] | Dynamic patching | No explicit deletion policy |
| **This Work** | **Budgeted optimization with 3-factor scoring** | **Addresses gap: explicit forgetting under constraints** |

---

## Implications for Our System

### 1. MEMORY.md Enhancement
Current implementation may benefit from explicit forgetting rules:
```markdown
## Memory Lifecycle
- **Active**: Currently relevant, high access frequency
- **Attenuated**: Reduced relevance, lower priority
- **Archived**: Rarely accessed, compress/summarize
- **Forgotten**: Below threshold, remove
```

### 2. JOURNAL Compaction
Instead of simple append-only, consider:
- Budget-aware consolidation
- Relevance scoring before compaction
- Three-factor evaluation (recency × frequency × semantic)

### 3. insights.md Maintenance
Current insights file grows unbounded. Apply framework:
- Fixed "insight budget" (e.g., max 200 entries)
- Relevance scoring: how often referenced? how recent? how semantically central?
- Periodic forgetting: archive low-relevance insights

### 4. Skill Context Management
Skills have their own "memory" in examples/notes:
- Track example usage frequency
- Score example relevance to recent tasks
- Prune low-value examples

---

## Research Questions Answered

1. **How can controlled forgetting under fixed budgets maintain performance?**
   → Through relevance-guided scoring integrating recency, frequency, and semantic alignment

2. **Impact on false memory rate?**
   → Significant reduction in false memory propagation without sacrificing accuracy

3. **Tradeoff between footprint, cost, and performance?**
   → Bounded optimization enables explicit tradeoff control; no context usage increase

---

## Connections to Prior Work

- **MemSkill** (arXiv:2602.02474): Controller-Executor-Designer for memory skills → complements with explicit forgetting
- **ProMem** (arXiv:2601.04463): Active memory extraction → could feed into forgetting decisions
- **ReMe** (arXiv:2512.10696): Procedural memory refinement → similar 3-tier structure

---

## Actionable Takeaways

1. **Implement scoring function**: recency × frequency × semantic_similarity
2. **Set memory budgets**: max entries per tier (working/short/long)
3. **Periodic forgetting**: scheduled compaction using scores
4. **Track false memories**: metrics for incorrect retrieval
5. **Budget as constraint**: optimization problem, not heuristic
