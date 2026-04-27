# DD898: FSFM — Selective Forgetting of Agent Memory

**Paper**: arXiv:2604.20300 (Apr 2026)
**Authors**: Gu et al.
**Relevance**: ⭐⭐⭐⭐⭐ CRITICAL — directly addresses our KB deduplication and memory bloat problems

## Summary

FSFM proposes a biologically-inspired framework for **selective forgetting** in LLM agent memory systems. Key insight: forgetting is as important as remembering. The framework establishes four forgetting mechanisms:

1. **Passive decay-based** — Ebbinghaus curve; memories lose weight over time unless reinforced
2. **Active deletion-based** — explicit pruning of outdated/superseded entries
3. **Safety-triggered** — forced forgetting of malicious/sensitive content
4. **Adaptive reinforcement-based** — memories accessed frequently are strengthened; unused ones decay

## Key Results

- **+8.49% access efficiency** from intelligent memory pruning
- **+29.2% signal-to-noise ratio** in content quality (most relevant for us)
- **100% security risk elimination** via safety-triggered forgetting

## Connection to Our System

### KB Deduplication (EXP-221)
The P1 notification about 35+ semantically duplicate entries maps directly to FSFM's "active deletion" mechanism. Their approach: compute semantic similarity, keep the most-accessed/most-recent version, decay duplicates. This is exactly what we need.

### Memory Consolidation Pattern
FSFM's hippocampal indexing model suggests a two-phase approach:
1. **Fast write** — store everything short-term (what we do now)
2. **Consolidation pass** — periodically merge, deduplicate, and prune (what we're missing)

### Actionable Recommendations
1. **Implement decay scoring** on knowledge entries: `score = base_relevance × recency_weight × access_count_factor`
2. **Add a consolidation sweep** that runs periodically to merge near-duplicate entries
3. **Track access counts** on KB entries to identify unused knowledge for archival

## Related Deep-Dives
- DD553 (BrainMem) — complementary hierarchical memory approach
- DD887/DD875 (StructMem) — structured memory for long-horizon tasks
- DD880 (Experience Compression) — compression as implicit forgetting
- DD896 (LightThinker) — adaptive memory management

## Also Noted: Memora Benchmark (arXiv:2604.20006)
Introduces FAMA (Forgetting-Aware Memory Accuracy) metric — penalizes reliance on obsolete memory. Relevant for evaluating any forgetting mechanism we implement. Key finding: existing memory agents frequently reuse **invalid/outdated** memories.
