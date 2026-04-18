# H-171: Graph-structured memory improves knowledge retrieval over flat files via associative paths

**Created**: 2026-04-18 by Bob
**Status**: proposed
**Confidence**: ★★☆☆ (initial estimate)
**Source**: DD-768 (GAM), DD-764 (dual-trace encoding), DD-765 (cooperative paging)
**Connects**: KE-011, H-170, CR-335

---

## Claim

Graph-structured memory with hierarchical abstraction (event → topic → concept layers) would improve agents' knowledge utilization over our current flat-file approach by enabling multi-factor associative retrieval — letting agents find relevant knowledge through semantic connections rather than requiring exact path knowledge or linear scanning.

## Mechanism

Our current system stores knowledge as flat files (KE-xxx.md, H-xxx.md) in directories. Retrieval requires: (1) knowing the file exists, (2) knowing its path, or (3) grep/search. KE-011 established that agents skip knowledge files — they're passive and undiscoverable.

GAM's insight: **decouple encoding from consolidation**. In our context:
- **Encoding** = writing a KE/hypothesis (fast, happens naturally)
- **Consolidation** = linking it into a retrievable graph structure (careful, currently doesn't happen)

A graph structure would create associative edges between knowledge entries (e.g., "context pollution" → CR-335 → DD-768 → H-171). At retrieval time, activating one node spreads activation to related nodes, surfacing relevant knowledge without needing to know exact paths.

The key bottleneck isn't storage — it's **retrieval routing**. Flat files require the agent to already know what to look for. Graph edges enable discovery of things the agent didn't know it needed.

## Evidence

### Supporting
- KE-011: Knowledge files are passive — agents skip them in oneshot mode. Graph edges could make them active by creating retrieval paths from task context
- DD-768: GAM outperforms flat retrieval on LoCoMo and LongDialQA benchmarks
- DD-764: Dual-trace encoding shows separate fast/slow memory improves retention — our single-tier flat files conflate both
- DD-765: Bookmark-based paging enables coarse retrieval; graph structure could add semantic precision on top
- Our `auto-matched from task` context injection already approximates graph retrieval (matching KEs to task keywords) but is shallow — only keyword overlap, no semantic edges

### Against / missing
- Our knowledge base is small (~200 KEs, ~170 hypotheses) — graph overhead may not pay off at this scale
- The `auto-matched from task` system already provides some retrieval without graph infrastructure
- Graph maintenance has a cost: every new entry needs edge creation, which adds overhead to the writing path
- LLM context windows keep growing — brute-force "load everything" may outpace structured retrieval

## Predictions

| Condition | Predicted outcome |
|-----------|-------------------|
| Graph retrieval implemented | Knowledge citation rate in sessions increases >2x (from ~5% to >10% of available relevant KEs) |
| Flat files + growing KB | Retrieval rate stays flat or decreases as KB grows (more files = harder to find) |
| Graph + associative queries | Agent discovers cross-domain connections it wouldn't find via keyword grep |

## Test Plan

- **Design**: Compare current flat-file retrieval vs graph-augmented retrieval on a set of synthesis tasks requiring multi-entry knowledge
- **Scenario**: Take 10 recent research sessions, measure how many relevant KEs were actually surfaced vs how many existed. Then simulate graph-augmented retrieval for the same sessions.
- **Decision rule**: Confirmed if graph retrieval surfaces >50% more relevant entries; falsified if improvement <10%

## Implications if true

- Invest in building a lightweight graph layer (could be SQLite adjacency table) over our knowledge entries
- Each KE/hypothesis write should include explicit "connects to" edges (we partially do this already with the Connects field)
- The auto-matched context injection system should traverse edges, not just keyword-match
- GAM's encoding/consolidation split suggests we should have a periodic "consolidation" pass that strengthens/prunes edges based on actual usage

## Links

- Parent / related: DD-768, DD-764, DD-765, KE-011, H-170
- Tracked in: agents/bob/workspace/todo.md
