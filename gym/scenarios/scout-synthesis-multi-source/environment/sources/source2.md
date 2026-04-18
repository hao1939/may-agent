# Source 2: Blog Post — "What We Learned Running 10,000 Agent Sessions" (AgentOps Blog)

Key observations from production deployment:
- Memory retrieval latency matters more than memory size — agents with <100ms retrieval are 2x more effective than those with >500ms
- The most valuable memories are FAILURE episodes, not success episodes — agents learn more from what went wrong
- Agents that share a common memory store converge on better strategies 40% faster than isolated agents
- Semantic similarity retrieval (embeddings) outperforms keyword matching for episode retrieval
- Top insight: "The memory architecture matters less than the retrieval strategy"
