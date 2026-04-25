# Deep Dive: Tool Attention — Dynamic Tool Gating for Agentic Workflows

**Paper**: arXiv:2604.21816 | **Date**: 2026-04-23
**Authors**: Anuj Sadani, Deepak Kumar
**Code**: https://github.com/asadani/tool-attention

## Summary

The "MCP/Tools Tax" problem: when agents have access to many tools (via MCP or similar), eagerly injecting all tool schemas into every prompt wastes 10k-60k tokens per turn. This causes:
1. **Context waste**: Tool schemas crowd out task-relevant content
2. **Reasoning degradation**: At ~70% context utilization, LLM reasoning quality drops sharply ("fracture point")
3. **Cost**: Token budgets become dominated by static tool definitions

**Tool Attention** solves this with a 3-component middleware:

### 1. Intent-Schema Overlap (ISO) Score
- Sentence embeddings compare user intent to tool descriptions
- Cheap, fast pre-filter that eliminates irrelevant tools

### 2. State-Aware Gating Function
- Enforces preconditions (e.g., "can't deploy without build")
- Respects access scopes per agent/role
- Dynamic: gate changes based on conversation state

### 3. Two-Phase Lazy Schema Loading
- **Phase 1**: Compact summary pool — one-line descriptions of all tools in context
- **Phase 2**: Full JSON schema promoted only for top-k gated tools
- Result: 95% reduction in tool tokens (47.3k → 2.4k)

## Key Results (simulated benchmark, 120 tools, 6 servers)
- Per-turn tool tokens: 47.3k → 2.4k (95% reduction)
- Effective context utilization: 24% → 91%
- End-to-end projections (not live-measured): improved task success, lower latency, reduced cost

## Relevance to Our System

### Direct Applications
1. **Agent tool selection**: Our agents get all tools in every session. As tools grow, we'll hit the same fracture point. A gating layer could help.
2. **Context budget**: We already struggle with context in long sessions. Reducing tool overhead gives more room for task content.
3. **The 70% fracture point**: This explains why sessions degrade as they get longer — context utilization crosses the threshold.

### Limitations
- Results are simulated/projected, not measured on live LLM agents
- 120-tool benchmark may not reflect our ~10-15 tool setup (our tax is smaller)
- Middleware layer adds latency and complexity

### Hypothesis Connection
- Relates to H-EXP-018 (Adaptive Knowledge Compression) — both address context efficiency
- Could inform how we structure tool definitions in agent prompts

## Verdict
**Monitor + experiment when tool count grows.** Currently our agents have ~10-15 tools so the tax is manageable (~2-3k tokens). But as we add MCP servers or more tools, this pattern becomes critical. The 70% fracture point finding is immediately useful as a design constraint.
