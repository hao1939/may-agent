# Tool Attention Is All You Need: Dynamic Tool Gating and Lazy Schema Loading

**Source**: arXiv:2604.21816  
**Authors**: Anuj Sadani, Deepak Kumar  
**Date**: April 23, 2026  
**Code**: https://github.com/asadani/tool-attention

## TL;DR

A middleware-layer mechanism that reduces MCP tool token overhead by 95% (47.3k → 2.4k tokens) through "Tool Attention" — a gated attention mechanism over tools rather than tokens. Raises effective context utilization from 24% to 91%.

## The Problem: MCP/Tools Tax

The Model Context Protocol (MCP) has become standard for connecting LLM agents to external tools, but its stateless, eager schema injection imposes a significant per-turn overhead:

- **10k-60k tokens** in typical multi-server deployments
- Inflates key-value cache
- Causes reasoning degradation as context approaches 70% utilization
- Becomes a recurring operational cost

## The Solution: Tool Attention

Generalizes the "Attention Is All You Need" paradigm from self-attention over tokens to **gated attention over tools**.

### Three Components

1. **Intent Schema Overlap (ISO) Score**: Uses sentence embeddings to match user intent to tool schemas
2. **State-Aware Gating Function**: Enforces preconditions and access scopes
3. **Two-Phase Lazy Schema Loader**: 
   - Keeps compact summary pool in context
   - Promotes full JSON schemas only for top-k gated tools

## Results

Benchmark: Simulated 120-tool, six-server deployment

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Per-turn tool tokens | 47.3k | 2.4k | **95.0% reduction** |
| Context utilization | 24% | 91% | **+67 points** |

Key thesis: **Protocol-level efficiency, not raw context length, is a binding constraint on scalable agentic systems.**

## Relevance to Our System

| Aspect | Implication |
|--------|-------------|
| **Token Efficiency** | Our dispatcher could implement ISO scoring for skill selection |
| **Lazy Loading** | Skill schemas could be loaded on-demand vs. all-upfront |
| **Context Pressure** | 70% utilization threshold is a critical design constraint |
| **Cost Model** | Per-turn token costs accumulate rapidly at scale |

## Actionable Insights

1. **Implement Tool Gating**: Add intent-based skill filtering before tool execution
2. **Lazy Schema Loading**: Load full skill definitions only when selected
3. **Context Budgeting**: Monitor and optimize context utilization actively
4. **Token-Aware Design**: Treat token efficiency as a first-class architectural constraint

## Why This Matters

MCP is becoming the de facto standard for tool integration. This paper identifies a fundamental scalability bottleneck that will affect any multi-agent system using MCP. The solution is elegant and generalizable — not specific to any single framework.

## Links

- Paper: https://arxiv.org/abs/2604.21816
- Code: https://github.com/asadani/tool-attention
