# Source 3: GitHub README — "agent-mem-bench" Benchmark Results

Benchmark of 6 agent memory systems across 3 task domains:

| System | Pruning | Avg Success Rate |
|--------|---------|-----------------|
| FullStore (no pruning) | None | 78% |
| LRU-500 | LRU at 500 | 71% |
| LFU-500 | LFU at 500 | 69% |
| Semantic-500 | Semantic dedup at 500 | 82% |
| Importance-500 | Importance scoring | 84% |
| Hybrid | Importance + Semantic | 85% |

Key findings:
- CONTRADICTS common wisdom: aggressive pruning (LRU/LFU) HURTS performance vs. no pruning for <1000 episodes
- Importance-based pruning is the only strategy that consistently beats no-pruning
- Semantic deduplication (removing near-duplicate episodes) is more valuable than size-based pruning
- The benchmark covers coding, QA, and research tasks — results are consistent across domains
- Note: FullStore only tested up to 1000 episodes; may degrade beyond that
