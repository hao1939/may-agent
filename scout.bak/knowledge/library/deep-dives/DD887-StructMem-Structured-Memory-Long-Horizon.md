# DD#887 — StructMem: Structured Memory for Long-Horizon Behavior in LLMs

**Paper:** "StructMem: Structured Memory for Long-Horizon Behavior in LLMs" (Xu et al., Apr 2026)
**arXiv:** 2604.21748
**Venue:** ACL 2026 main conference
**Rating:** ★★★★★

## Core Contribution

Addresses the flat-vs-graph memory tradeoff: flat memory is efficient but loses relational structure; graph memory captures relations but is expensive/fragile. StructMem proposes a **structure-enriched hierarchical memory** that:
1. Preserves **event-level bindings** (who/what/when/where within each event)
2. Induces **cross-event connections** via periodic semantic consolidation
3. Uses **temporally anchored dual perspectives** for temporal reasoning

## Key Results (on LoCoMo benchmark)

- Improves temporal reasoning and multi-hop QA performance
- Substantially reduces token usage, API calls, and runtime vs. prior memory systems
- Bridges the quality gap between flat and graph-based approaches without graph construction cost

## Relevance to Our System

**HIGH.** Our agents maintain persistent memory (knowledge entries, deep-dives, context files). Key connections:

1. **For KE-101 (Structure > Content)** — StructMem provides external validation: structure-enriched memory outperforms both flat retrieval and expensive graph construction. Aligns with Bob's Five Laws finding that structure matters more than content.
2. **Memory consolidation pattern** — Periodic semantic consolidation maps to our checkpoint/context.md pattern. We could structure agent memory with event-level bindings rather than flat text.
3. **Temporal reasoning** — Our agents struggle with "when did X happen" queries across sessions. StructMem's temporal anchoring directly addresses this.
4. **For EXP-221 (KB deduplication)** — Cross-event connection induction is essentially what deduplication needs: detecting semantic overlap between independently created entries.

## Limitations

- Evaluated on conversational QA, not agentic task execution
- Consolidation periodicity needs tuning per domain
- No adversarial evaluation (could hallucinated connections propagate?)

## Connection to Existing DDs

- DD#764 (Dual-Trace Memory Encoding) — complementary: dual-trace for encoding, StructMem for organization
- DD#768 (GAM Hierarchical Graph Memory) — direct competitor/alternative approach
- DD#765 (Cooperative Memory Paging) — StructMem's consolidation could enhance the bookmark approach

## Tags
`memory-architecture` `temporal-reasoning` `structure` `consolidation` `long-horizon`
