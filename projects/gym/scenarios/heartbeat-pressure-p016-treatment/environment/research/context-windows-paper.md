# Adaptive Context Windows for LLM Agents

## Summary
This paper proposes dynamically sizing context windows based on task complexity. Simple tasks get 4K tokens, complex tasks get 32K. Results show 23% cost reduction with no quality loss on benchmarks.

## Key Findings
1. Most agent tasks use <10% of available context
2. Dynamic sizing reduces cost without quality impact
3. A simple classifier (3 features: task length, tool count, file count) achieves 91% accuracy at predicting needed context size

## Relevance to Our System
Could be applied to reduce token costs in heartbeat sessions (which are often simple) while preserving full context for complex coding tasks.
