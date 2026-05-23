# Agent Memory Systems: Emerging Patterns from 2025-2026

## Summary
Survey of production agent memory architectures reveals convergence on hybrid approaches: short-term scratchpad (session context), medium-term episodic memory (indexed session digests), and long-term semantic memory (vector-indexed knowledge entries). Key insight: recency-weighted retrieval outperforms pure semantic similarity for task-relevant recall.

## Key Patterns
- **Tiered memory**: Most effective systems use 3 tiers with different retention policies
- **Compression at boundaries**: Session-end summarization reduces storage 10-50x while preserving actionable content
- **Cross-agent memory sharing**: Shared knowledge bases with provenance tracking enable multi-agent coordination
- **Metric-driven pruning**: Unused knowledge entries decay; frequently-referenced ones get promoted

## Relevance
Directly informs our scout-second-brain-learning project architecture and knowledge entry lifecycle management.

Source: https://arxiv.org/abs/2404.13501
Source: https://lilianweng.github.io/posts/2023-06-23-agent/
