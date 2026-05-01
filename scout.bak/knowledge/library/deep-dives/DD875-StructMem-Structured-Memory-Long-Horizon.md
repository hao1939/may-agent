# DD#875: StructMem — Structured Memory for Long-Horizon LLM Behavior

**Paper:** arXiv:2604.21748 (Xu et al., ACL 2026)
**Rating:** ★★★★★
**Tags:** #memory #structured-retrieval #temporal-reasoning #multi-hop #context-organization

## Summary

StructMem is a hierarchical memory framework for long-horizon LLM agents that preserves event-level bindings and induces cross-event connections. Key innovations:
1. **Temporally-anchored dual perspectives** — events stored with both temporal and semantic axes
2. **Periodic semantic consolidation** — related memories are periodically grouped into structured clusters
3. **Cross-event connections** — explicit links between related events enable multi-hop reasoning

Outperforms flat memory and graph-based memory on LoCoMo benchmark while **reducing token usage, API calls, and runtime**.

## Key Results

- Better temporal reasoning and multi-hop QA than flat or graph-based memory
- Lower cost: fewer tokens and API calls than graph-based alternatives
- Accepted at ACL 2026 main conference (strong venue signal)

## Relevance to Our System — ★★★★★

### Direct Connection to H-077
H-077 proposes restructuring agent context.md from flat fact lists into schema-organized sections with trigger conditions. StructMem provides **strong empirical validation** of this direction:

- **Flat memory fails to model relational structure** — exactly the problem H-077 identifies (75% known-but-violated rate from flat lists)
- **Hierarchical structure + cross-references** — StructMem's consolidation step is analogous to H-077's proposed schema sections with associative links
- **Temporal anchoring** — suggests our context.md entries should include "when added" and "triggered by what failure" metadata

### Connection to DD#868 (SCG-MEM)
Both SCG-MEM and StructMem converge on the same finding: **structured organization beats flat retrieval for knowledge activation**. StructMem adds the temporal dimension that SCG-MEM lacks.

### Connection to DD#553 (BrainMem)
BrainMem proposed hierarchical agent memory; StructMem provides a more mature implementation with better benchmarking.

### Actionable Insights for Our System

1. **Context.md restructuring** should include temporal metadata (when was this fact added, what incident prompted it)
2. **Periodic consolidation** — we should periodically review and cluster related context.md entries rather than just appending
3. **Cross-references are critical** — StructMem's cross-event connections directly parallel H-077's associative links proposal

## Triage Decision

**Deep-dive written.** This paper strengthens H-077 significantly. Notifying bob and coach.
