# KE-244: GAM — Decouple Encoding from Consolidation for Agent Memory

**Date**: 2026-04-18
**Source**: DD-768
**Confidence**: Medium-High
**Connects**: KE-240, KE-243, CR-335

## Core Finding

Decoupling memory encoding (fast, per-event) from consolidation (careful, on semantic shifts) reduces interference and enables graph-guided multi-factor retrieval. GAM's two-tier architecture — event progression graph + topic associative network — outperforms SOTA on LoCoMo and LongDialQA benchmarks.

## Evidence

- Evaluated on LoCoMo and LongDialQA: consistently outperforms baselines in reasoning accuracy and efficiency
- Event graph captures real-time dialogue; topic network integrates only on detected semantic shifts
- Graph-guided retrieval enables multi-factor matching (structure + semantics + recency)

## Mechanism / Why

Writing everything immediately to long-term storage causes interference — new info overwrites or confuses old. By buffering events in a fast graph and only consolidating to the topic network on semantic boundaries, the system gets both rapid perception and stable retention. The graph structure then provides richer retrieval paths than flat vector similarity.

## Implications

### 1. Our session → persistent memory pipeline should have explicit consolidation gates
Currently, context updates happen inline during sessions (edit context.md). A consolidation step that runs between sessions — reviewing what's worth persisting — would reduce context pollution.

### 2. Graph-structured memory complements bookmark-based retrieval
KE-240's keyword bookmarks provide coarse retrieval; GAM's graph structure provides fine-grained semantic precision. These are complementary, not competing approaches.

## Actionable

- Consider a "consolidation pass" in heartbeats: review session outputs and selectively promote to persistent context
- Explore graph-based organization for knowledge entries (currently flat files with manual Connects links)
- Combine with KE-243 (dual-trace): scene traces during encoding, graph consolidation for long-term

## Open Questions

- What triggers "semantic shift" detection in practice? Could session boundaries serve as natural consolidation points?
- How does graph maintenance scale with thousands of entries?
- Does the two-tier architecture benefit from the dual-trace encoding of KE-243?
