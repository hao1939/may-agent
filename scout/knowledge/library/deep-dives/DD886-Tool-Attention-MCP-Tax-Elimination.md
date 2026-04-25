# DD#886 — Tool Attention: Dynamic Tool Gating to Eliminate the MCP/Tools Tax

**Paper:** "Tool Attention Is All You Need: Dynamic Tool Gating and Lazy Schema Loading for Eliminating the MCP/Tools Tax in Scalable Agentic Workflows" (Sadani & Kumar, Apr 2026)
**arXiv:** 2604.21816
**Rating:** ★★★★½

## Core Contribution

Identifies the "MCP Tax" — a hidden 10k–60k token overhead per turn from eagerly injecting all tool schemas into context. Proposes **Tool Attention**, a middleware that:
1. **Intent-Schema Overlap (ISO) score** — sentence embeddings match user intent to tool descriptions
2. **State-aware gating** — enforces preconditions/access scopes before exposing tools
3. **Two-phase lazy schema loading** — keeps compact summaries in context, promotes full JSON schemas only for top-k gated tools

## Key Results (simulated 120-tool, 6-server benchmark)

- Per-turn tool tokens: **47.3k → 2.4k** (95% reduction)
- Effective context utilization: **24% → 91%**
- End-to-end projections (not measured on live agents): improved task success, latency, cost
- Reasoning degradation starts at ~70% context utilization ("fracture points")

## Relevance to Our System

**HIGH.** Our agent system uses multiple tools per agent. Key connections:

1. **Context budget pressure** — We already see reasoning degradation when context fills up. The 70% fracture point aligns with our observations about verification quality dropping as context grows.
2. **For EXP-099 (Verification Gravity Well)** — Tool schema bloat may contribute to the verification degradation pattern. If verification tools consume significant context budget, less is available for actual reasoning.
3. **Architecture pattern** — The lazy-loading + gating pattern is directly applicable: keep tool summaries compact, expand only when needed.
4. **Protocol-level efficiency thesis** — "Protocol-level efficiency, not raw context length, is a binding constraint on scalable agentic systems." This reframes our token budget discussions.

## Limitations

- Results are **simulated/projected**, not measured on live LLM agents
- 120-tool benchmark is calibrated to "public audits" but not real deployment
- No comparison to dynamic tool selection baselines (e.g., ToolBench, ToolLLM)

## Connection to Existing DDs

- DD#765 (Cooperative Memory Paging) — similar compact-summary-then-expand pattern
- DD#783 (ContextCurator) — RL-trained context selection; complementary approach
- DD#701 (Verification Orchestration) — protocol-level efficiency for verification

## Tags
`tool-selection` `context-efficiency` `MCP` `protocol-design` `token-budget`
