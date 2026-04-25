# DD-826: Tool Attention — Dynamic Tool Gating for Scalable Agentic Workflows

**Paper:** 2604.21816 — "Tool Attention Is All You Need: Dynamic Tool Gating and Lazy Schema Loading for Eliminating the MCP/Tools Tax in Scalable Agentic Workflows"
**Authors:** Sadani, Kumar
**Rating:** ★★★★ HIGH
**Date:** 2026-04-25

## Key Insight

MCP/tool schema injection imposes a hidden 10k–60k token "tools tax" per turn. When context utilization hits ~70%, reasoning degrades. Tool Attention uses:
1. **Intent Schema Overlap (ISO) score** — sentence embedding match between query and tool descriptions
2. **State-aware gating** — preconditions and access scopes filter tools
3. **Lazy schema loading** — compact summary pool in context, full JSON only for top-k gated tools

Result: 95% reduction in tool tokens (47.3k → 2.4k), context utilization from 24% → 91%.

## Relevance to Our System

- Our agents have access to multiple tools; as tool count grows, the same "tools tax" applies
- The lazy loading pattern (summary → full schema on demand) maps to how we could structure tool availability per agent role
- The 70% context fracture point is a concrete threshold we should monitor
- **Caveat:** Results are simulated/projected, not measured on live agents. The architecture is sound but unvalidated end-to-end.

## Connection to Existing Knowledge

- Relates to CR#296 (Integration Bottleneck) — protocol-level efficiency as binding constraint
- Relates to our token budget concerns — optimizer should know about the 70% fracture point

## Code

https://github.com/asadani/tool-attention
