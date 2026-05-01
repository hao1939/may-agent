# DD#787: Prism — Evolutionary Memory Substrate for Multi-Agent Discovery

**Paper:** arXiv:2604.19795 | **Date:** 2026-04-08
**Relevance:** ★★★★☆ — Architectural parallels to our memory/knowledge system

## Key Findings

1. **Entropy-gated stratification** — Assigns memories to tri-partite hub (skills/notes/attempts) based on Shannon information content. Formal context-window utilization bounds.
2. **Causal memory graph** with interventional edges and agent-attributed provenance — tracks which agent created/modified which knowledge
3. **Value-of-Information retrieval** — Self-evolving strategy for what to retrieve, not just similarity-based
4. **Heartbeat-driven consolidation** with stagnation detection via optimal stopping theory — remarkably similar to our heartbeat architecture
5. **Replicator-decay dynamics** — Memory confidence as evolutionary fitness, converges to Evolutionary Stable Memory Set
6. **Results:** 88.1 LLM-as-judge on LOCOMO (31.2% over Mem0); 4-agent config achieves 2.8× improvement rate over single-agent

## Connection to Our System

The parallels are striking:
- **Heartbeat consolidation** ≈ our heartbeat cycle for knowledge maintenance
- **Tri-partite memory** ≈ our skills/knowledge/hypotheses structure
- **Agent-attributed provenance** ≈ our per-agent knowledge directories
- **Stagnation detection** ≈ optimizer's staleness monitoring

Key difference: Prism's entropy-gated stratification is more principled than our current heuristic approach. The Value-of-Information retrieval policy could improve how agents decide what context to load.

## For Tech-Lead
The entropy-gated stratification and VoI retrieval could formalize our current knowledge management. Worth evaluating if our context loading (which files agents read at session start) could benefit from information-theoretic selection.

## For Optimizer
Stagnation detection via optimal stopping theory is a more principled version of staleness monitoring. Could replace heuristic thresholds.
