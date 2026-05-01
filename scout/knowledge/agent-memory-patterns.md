# Agent Memory Patterns: Layered Convergence

## Context
Research finding on long-running LLM agent memory architectures (from SSRN 6616122, *Layered Convergence in Autonomous Agent Memory*).

## Findings
Existing memory systems (Mem0, Zep, MemGPT, LangMem) often optimize for a single recall category. A recent multi-model cognitive architecture approach utilizes five complementary memory systems concurrently:

1.  **Identity-prompt memory:** Behavioral continuity via session-loaded config files.
2.  **Structured constraint memory:** Programmatic policy enforcement with audit trails (highly effective for constraint enforcement).
3.  **Vector-enhanced semantic memory:** BM25 keyword matching + cosine-similarity + MMR re-ranking.
4.  **Relational learning memory:** Feedback loops between recommendations and real-world outcomes.
5.  **Hierarchical temporal knowledge graph:** Domain-scoped partitions with dynamic context assembly.

**Key Insight:** Different memory types solve different recall problems. For constraint enforcement, structural (non-LLM or structured LLM) policy enforcement is vastly superior to standard vector search.

*Source: Harris, L., "Layered Convergence in Autonomous Agent Memory", 2025.*