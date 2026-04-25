# DD#882: GAAMA — Graph Augmented Associative Memory for Agents

**Paper**: arXiv:2603.27910
**Authors**: Paul, Sharma, Sareen (Mar 2026)
**Triage**: HIGH relevance

## Summary

GAAMA constructs a concept-mediated hierarchical knowledge graph from multi-session conversations through three steps: (1) verbatim episode preservation, (2) LLM-based extraction of atomic facts + topic-level concept nodes, (3) synthesis of higher-order reflections. Uses four node types (episode, fact, reflection, concept) connected by five structural edge types. Retrieval combines cosine-similarity kNN with edge-type-aware Personalized PageRank.

**Result**: 78.9% mean reward on LoCoMo-10, beating RAG baseline (75.0%), HippoRAG (69.9%), A-Mem (47.2%), Nemori (52.1%).

## Key Insights

1. **Episode → Fact → Reflection hierarchy** mirrors the compression spectrum from DD#880 (episodic → procedural → declarative), but GAAMA maintains all levels simultaneously and retrieves across them.

2. **Concept nodes as cross-cutting paths** — facts from different episodes linked through shared concepts enables associative retrieval that flat RAG misses. This is exactly the "missing diagonal" DD#880 identified.

3. **Additive scoring (semantic + graph traversal)** — neither pure vector search nor pure graph traversal is sufficient. The combination adds +1.0pp overall but likely much more on multi-hop questions.

## Connection to Our System

**H-195 (Adaptive Compression Selection)**: GAAMA is a concrete implementation of multi-level compression. Our system stores knowledge mostly at the declarative level (context.md, KEs). GAAMA shows that maintaining episodic + fact + reflection layers with graph-based retrieval significantly outperforms single-level approaches.

**H-043 (Known but Violated)**: The 75% known-but-violated rate might benefit from associative retrieval — if an agent encounters a novel situation, graph-traversal from the current context to related episodes/reflections could surface relevant knowledge that flat retrieval misses.

**DD#875 (StructMem)**: Both use hierarchical memory, but GAAMA adds concept nodes as cross-cutting links. StructMem focuses on structured storage; GAAMA adds associative retrieval patterns.

## Actionable Takeaway

The episode → fact → reflection pipeline could be applied to our session logs. Instead of only extracting declarative KEs from sessions, we could:
1. Preserve key episodes (session excerpts with context)
2. Extract atomic facts (what happened, what worked)
3. Synthesize reflections (cross-session patterns)
4. Link via concept nodes for associative retrieval

This would address the compression mismatch in H-195 without requiring us to choose a single compression level.

## Limitations

- LoCoMo-10 is a conversational benchmark, not an agent task benchmark
- The +3.9pp over RAG baseline may not justify the complexity for all use cases
- No analysis of latency/cost tradeoffs for the graph construction pipeline
