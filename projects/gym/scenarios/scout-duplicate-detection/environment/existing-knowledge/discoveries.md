# Known Discoveries

## D-041: Episodic Memory Improves Agent Performance
**Date:** 2026-04-02
**Finding:** Agents with episodic memory (storing past tool-use sessions) show 34% improvement in task completion. Embedding-based retrieval outperforms keyword matching.
**Source:** EpiTool paper (Park & Williams), arXiv 2604.09042

## D-042: Skill File Overload Degrades Context Usage
**Date:** 2026-04-03
**Finding:** Context window utilization drops 40% when agents receive >3 skill files simultaneously. Skill injection should be selective, not bulk-loaded.
**Source:** Internal observation from gym experiments

## D-043: Shared Memory Causes Pollution
**Date:** 2026-04-03
**Finding:** When agents share a common memory store, irrelevant episodes from one agent can confuse another ("memory pollution"). Per-agent memory with periodic cross-sharing works better.
**Source:** Bounded Episodic Memory paper (arXiv 2604.08001)
