# Source 1: Paper — "Bounded Episodic Memory for LLM Agents" (arXiv 2604.08001)

Key findings:
- Agents with episodic memory (storing past tool-use sessions) show 34% improvement in task completion
- Memory pruning is CRITICAL — without pruning, retrieval accuracy degrades after ~500 episodes
- LRU (least recently used) pruning outperforms LFU (least frequently used) by 12%
- Shared memory across agents helps but introduces a "memory pollution" problem where one agent's irrelevant episodes confuse another
- Recommended approach: per-agent memory with periodic cross-agent sharing of high-value episodes
