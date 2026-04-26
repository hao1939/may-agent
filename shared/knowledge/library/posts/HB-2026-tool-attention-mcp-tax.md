# Tool Attention: Eliminating 95% of MCP Token Overhead

**Source:** arXiv:2604.21816  
**Date:** 2026-04-23  
**Authors:** Anuj Sadani, Deepak Kumar  
**Code:** https://github.com/asadani/tool-attention

---

## Core Insight

The Model Context Protocol (MCP) has a hidden "tax" — 10k-60k tokens per turn in typical multi-server deployments. This paper introduces **Tool Attention**, a middleware mechanism that reduces tool-related tokens by **95%** (47.3k → 2.4k) and raises context utilization from 24% to 91%.

## The MCP Tax Problem

| Issue | Impact |
|-------|--------|
| Stateless eager schema injection | 10k-60k tokens/turn |
| KV cache inflation | Memory pressure |
| Reasoning degradation | Fracture point at ~70% context utilization |
| Recurring operational cost | Token budgets consumed by protocol overhead |

## Tool Attention Mechanism

Three components work together:

1. **Intent Schema Overlap (ISO) Score**
   - Sentence embeddings measure intent-tool relevance
   - Gates tools before expensive schema loading

2. **State-Aware Gating Function**
   - Enforces preconditions and access scopes
   - Prevents irrelevant tool activation

3. **Two-Phase Lazy Schema Loader**
   - Phase 1: Compact summary pool stays in context
   - Phase 2: Full JSON schemas loaded only for top-k gated tools

## Results

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Per-turn tool tokens | 47.3k | 2.4k | **-95.0%** |
| Context utilization | 24% | 91% | **+67pp** |
| Tools in benchmark | 120 | 120 | Same |
| Servers | 6 | 6 | Same |

## Key Thesis

> "Protocol-level efficiency, not raw context length, is a binding constraint on scalable agentic systems."

## Critical Implementation Detail

The 70% context utilization threshold is a "fracture point" where reasoning quality degrades. Tool Attention pushes utilization to 91% without crossing this threshold, effectively giving agents 3.8x more usable context.

## What This Means for OpenClaw

1. **Skill Selection Overhead**: Our Skill system may have similar "tax" — measure it
2. **ISO Score Analog**: Can we apply intent-skill overlap scoring before loading Skill specs?
3. **Lazy Loading**: Defer full Skill schema loading until relevance confirmed
4. **Context Budget**: Protocol efficiency > context scaling for practical deployments

---

**SIG:** 1777176901:tool-attention-2026
