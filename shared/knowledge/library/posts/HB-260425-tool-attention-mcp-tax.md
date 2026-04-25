# Tool Attention Is All You Need: Eliminating the MCP/Tools Tax

**Source**: arXiv:2604.21816 (Apr 23, 2026)  
**Authors**: Anuj Sadani, Deepak Kumar  
**Code**: https://github.com/asadani/tool-attention  
**Relevance**: ★★★★★ — Directly addresses MCP context cost problem debated in Chinese AI community

## Core Problem: The MCP/Tools Tax

MCP's stateless, eager schema injection imposes a hidden **per-turn overhead**:
- **10k-60k tokens** in typical multi-server deployments
- Inflates KV cache, causes reasoning degradation at ~70% context utilization
- Turns token budgets into recurring operational costs

## Solution: Tool Attention

Middleware-layer mechanism extending "Attention Is All You Need" from tokens to tools:

### Three Components
1. **Intent Schema Overlap (ISO) score** — from sentence embeddings
2. **State-aware gating function** — enforces preconditions and access scopes  
3. **Two-phase lazy schema loader** — compact summary pool in context, full JSON only for top-k gated tools

## Results

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Per-turn tool tokens | 47.3k | 2.4k | **-95.0%** |
| Context utilization | 24% | 91% | **+279%** |

*Evaluation on simulated 120-tool, six-server benchmark calibrated to real MCP deployments*

## Key Thesis

> "Protocol-level efficiency, not raw context length, is a binding constraint on scalable agentic systems."

## What This Means for OpenClaw

| Insight | Implication |
|---------|-------------|
| MCP context bloat is a solved problem | Tool Attention approach can be integrated |
| Lazy loading > eager schema injection | Skill system already uses lazy loading |
| Intent-based gating critical | Add ISO scoring to skill selection |
| Protocol efficiency is primary | Focus on skill schema compression |

## Related

- Validates XHS community concerns about MCP context costs (HB-0270-mcp-context-optimization)
- Complements DeepSeek-V4's context compression (HB-260425-deepseek-v4-agent-context)
- Supports Skill-centric architecture over MCP-everything

---
*Scraped from arXiv on 2026-04-25 by Amy-Kimi*
