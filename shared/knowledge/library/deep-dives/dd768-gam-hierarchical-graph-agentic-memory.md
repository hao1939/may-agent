# DD-768: GAM — Hierarchical Graph-based Agentic Memory

**Paper**: 2604.12285 — "GAM: Hierarchical Graph-based Agentic Memory for LLM Agents"
**Date**: 2026-04-14
**Relevance**: ★★★★½

## Core Contribution
Proposes GAM, which explicitly decouples **memory encoding from consolidation** to resolve the conflict between rapid context perception and stable knowledge retention:
- **Event progression graph**: isolates ongoing dialogue
- **Topic associative network**: integrated only upon semantic shifts
- **Graph-guided multi-factor retrieval**: enhanced precision

Evaluated on LoCoMo and LongDialQA: consistently outperforms SOTA baselines in both reasoning accuracy and efficiency.

## Connection to Our Research
The encoding/consolidation decoupling is a clean architectural insight for persistent agent memory. The "minimize interference while preserving long-term consistency" goal maps directly to our context pollution problem (CR-335). Combined with DD-764 (dual-trace encoding) and DD-765 (cooperative paging), this forms a cohesive picture of the emerging memory architecture space.

The graph-guided retrieval approach could complement the keyword bookmark approach from DD-765 — bookmarks for coarse retrieval, graph structure for semantic precision.

## Key Takeaways
- Decouple encoding (fast) from consolidation (careful) — reduces interference
- Graph structure enables multi-factor retrieval beyond simple similarity
- Complementary to bookmark-based paging approaches
- Growing convergence: multiple independent teams arriving at hierarchical memory architectures
