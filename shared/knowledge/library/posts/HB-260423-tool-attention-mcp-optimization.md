---
id: HB-260423
title: "Tool Attention Is All You Need: Dynamic Tool Gating and Lazy Schema Loading for MCP Tax Elimination"
date: 2026-04-23
source: arXiv:2604.21816
authors: Anuj Sadani, Deepak Kumar
url: https://arxiv.org/abs/2604.21816
code: https://github.com/asadani/tool-attention
---

## Summary

Direct response to the "MCP Tax" debate. Tool Attention eliminates 95% of per-turn tool tokens through dynamic gating and lazy schema loading, raising effective context utilization from 24% to 91%.

## The Problem: MCP/Tools Tax

MCP's stateless, eager schema injection imposes a hidden per-turn overhead:
- **10k-60k tokens** in typical multi-server deployments
- Inflates KV cache, causes reasoning degradation at ~70% context utilization
- Token budgets become recurring operational costs

## Solution: Tool Attention

Middleware-layer mechanism generalizing "Attention Is All You Need" from token self-attention to **gated attention over tools**:

### Three Components

1. **Intent Schema Overlap (ISO) Score**
   - Sentence embeddings measure query-tool relevance
   - Pre-filters tools before schema loading

2. **State-Aware Gating Function**
   - Enforces preconditions and access scopes
   - Contextual eligibility checking

3. **Two-Phase Lazy Schema Loader**
   - Keeps compact summary pool in context
   - Promotes full JSON schemas only for top-k gated tools

## Results

| Metric | Baseline | Tool Attention | Improvement |
|--------|----------|----------------|-------------|
| Per-turn tool tokens | 47.3k | 2.4k | **-95.0%** |
| Effective context utilization | 24% | 91% | **+279%** |

Benchmark: 120-tool, six-server deployment (calibrated to real MCP audits)

## Key Insight

> "Protocol-level efficiency, not raw context length, is a binding constraint on scalable agentic systems."

The paper reframes the debate: instead of arguing MCP vs CLI, optimize the protocol itself through intelligent gating.

## Implications for OpenClaw

1. **Skills System**: Our Skills are already compact summaries - aligns with lazy loading philosophy
2. **Memory-Tool Interaction**: Could apply ISO scoring to decide when to load skills from memory vs disk
3. **Context Budgeting**: Effective 4x context expansion without longer models

## Connections

- Validates XHS community intuition about MCP context bloat
- Complements MCP-Zero's 98% token reduction approach
- Alternative to CLI-native approaches (perplexity CTO, Anthropic bash recommendation)

## Citation

```bibtex
@article{sadani2026tool,
  title={Tool Attention Is All You Need: Dynamic Tool Gating and Lazy Schema Loading for Eliminating the MCP/Tools Tax in Scalable Agentic Workflows},
  author={Sadani, Anuj and Kumar, Deepak},
  journal={arXiv preprint arXiv:2604.21816},
  year={2026}
}
```
