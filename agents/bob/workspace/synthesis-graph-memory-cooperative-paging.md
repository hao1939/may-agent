# Synthesis: Graph Memory (DD-768) + Cooperative Paging (DD-765)

**Date**: 2026-04-18 | **Thread**: DD-768/DD-765 cross-reference

## Key Findings

### DD-765 (Cooperative Paging) → KE-219
Replacing full context with keyword bookmarks + recall() **outperforms full context**. The bottleneck is bookmark discrimination (57% correct page selection), not retrieval mechanics. Simple fixed-size pages beat clever topic-aware segmentation. The 25pp accuracy gap from keyword specificity means index quality is the binding constraint.

### DD-768 (Graph Agentic Memory) → H-171
Graph-structured memory with event→topic→concept layers enables associative retrieval — finding knowledge through semantic connections rather than exact path knowledge. Decoupling encoding (writing KEs) from consolidation (linking them into a graph) is the key architectural insight.

## Complementary, Not Competing — Different Layers of the Same Problem

These address **two distinct layers** of the knowledge utilization stack:

| Layer | Problem | Solution |
|-------|---------|----------|
| **Retrieval routing** (DD-768/H-171) | Agent doesn't know what knowledge exists or how entries relate | Graph edges create associative paths → discovery of unknown-unknowns |
| **Context delivery** (DD-765/KE-219) | Agent has too much context, can't find the needle | Bookmarks + on-demand paging → precision without overload |

They compose naturally: the graph tells you *what's relevant*, the paging system tells you *how to deliver it* without flooding context.

## Combined Architecture for Our System

```
┌─────────────────────────────────────────────┐
│  Agent Session Context                       │
│  ┌────────────────────────────────────────┐  │
│  │ Bookmark Index (KE-219 style)          │  │
│  │ [graph:H-171] graph memory, retrieval  │  │
│  │ [page:KE-091] alignment tax, guards    │  │
│  │ [page:KE-011] passive knowledge, skip  │  │
│  └──────────────┬─────────────────────────┘  │
│                 │ recall(topic)               │
│                 ▼                             │
│  ┌────────────────────────────────────────┐  │
│  │ Graph Layer (H-171 style)              │  │
│  │ SQLite adjacency: KE↔KE, KE↔H, H↔DD  │  │
│  │ Traverses edges from query context     │  │
│  │ Returns: ranked entry set              │  │
│  └──────────────┬─────────────────────────┘  │
│                 │ top-k entries               │
│                 ▼                             │
│  ┌────────────────────────────────────────┐  │
│  │ Paging Delivery (KE-219 style)         │  │
│  │ Inject bookmark summaries, not content │  │
│  │ Agent pulls full entry on demand       │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**Layer 1 — Graph index** (from H-171): SQLite table of edges between knowledge entries. The existing `Connects:` fields in our KEs/hypotheses are proto-edges — formalize them. Periodic consolidation pass strengthens frequently co-activated edges.

**Layer 2 — Bookmark delivery** (from KE-219): Instead of injecting 5-10 full KE blocks into context (current approach), inject a compact bookmark index (one distinctive line per entry). Agent calls recall() to pull specific entries. This is *less* context but *better* retrieval — DD-765's core finding.

**Layer 3 — Thought depth** (from H-170): Match retrieval depth to query complexity. Simple task → inject KE title only. Complex synthesis → inject full hypothesis chain. DD-772's thought-retrieval insight.

## Impact Ranking

1. **Bookmark quality audit** (highest ROI, lowest effort) — KE-219 shows 25pp from keyword specificity alone. Audit our ~200 KE titles for distinctiveness. Many are vague ("Context management finding"). This is a 1-session task with immediate payoff.

2. **Formalize graph edges** (medium effort, structural improvement) — Convert existing `Connects:` fields into queryable SQLite adjacency table. Enables associative traversal. ~2-3 sessions.

3. **Paging delivery rewrite** (larger effort, biggest upside) — Replace current "inject matched entries as full blocks" with bookmark-index + on-demand-pull. Requires tooling changes but DD-765 shows it's strictly better.

## Connections to Existing Knowledge

- **KE-011** (knowledge is passive): Both papers confirm this — the fix is better retrieval routing, not more content
- **KE-052** (structural access > content quality): Graph edges and bookmarks are both structural access improvements
- **H-170** (thought-retriever): The depth-tiered retrieval from DD-772 slots into layer 3 of this architecture
- **DD-771** (context curation): Heartbeat context curation is already a manual version of cooperative paging — agent curates what stays in context each cycle

## Open Question

Does our ~200-entry knowledge base justify graph infrastructure? DD-765 tested 20-page systems, DD-768 tested larger corpora. We might be in a sweet spot where a well-curated bookmark index (approach 1) captures 80% of the value without needing full graph traversal. **Test the cheap thing first.**
