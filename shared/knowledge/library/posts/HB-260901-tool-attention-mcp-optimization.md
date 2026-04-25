---
id: HB-260901
date: 2026-04-25
title: "Tool Attention Is All You Need: 95% MCP Token Reduction"
source: arXiv:2604.21816
authors: Anuj Sadani, Deepak Kumar
url: https://arxiv.org/abs/2604.21816
stars: ★★★★★
tags: [mcp, tool-calling, context-optimization, protocol-efficiency]
---

# Tool Attention Is All You Need: Dynamic Tool Gating and Lazy Schema Loading

## Key Insight

MCP (Model Context Protocol) imposes a hidden "MCP Tax" of 10k-60k tokens per turn in multi-server deployments. This paper introduces **Tool Attention** — a middleware-layer mechanism that reduces per-turn tool tokens by **95%** (47.3k → 2.4k) and raises context utilization from 24% to 91%.

## Core Mechanism

Tool Attention generalizes the "Attention Is All You Need" paradigm from self-attention over tokens to **gated attention over tools**:

### Three Components:

1. **Intent Schema Overlap (ISO) Score**
   - Sentence embedding-based relevance scoring
   - Measures intent-to-tool alignment

2. **State-Aware Gating Function**
   - Enforces preconditions and access scopes
   - Dynamic tool availability based on execution state

3. **Two-Phase Lazy Schema Loader**
   - Keeps compact summary pool in context
   - Promotes full JSON schemas only for top-k gated tools

## Results

| Metric | Baseline | Tool Attention | Improvement |
|--------|----------|----------------|-------------|
| Per-turn tool tokens | 47.3k | 2.4k | **-95.0%** |
| Context utilization | 24% | 91% | **+67pp** |
| Multi-server overhead | 10k-60k | Minimal | Eliminated |

## Critical Finding: 70% Fracture Point

The paper validates XHS community concerns about MCP context costs:
- Context utilization approaching **70%** correlates with reasoning degradation
- MCP Tax inflates KV-cache and turns token budgets into recurring operational costs
- **Protocol-level efficiency > raw context length** for scalable agentic systems

## Code Availability

Reference implementation: https://github.com/asadani/tool-attention

## What This Means for OpenClaw

1. **Skill Selection Optimization**: Add ISO-like intent scoring to Skill selection
2. **Lazy Loading Validation**: Our Skill system already uses lazy loading — this validates the approach
3. **Context Telemetry**: Instrument MCP overhead to monitor 70% context threshold
4. **Multi-Server Deployments**: Critical for enterprise scenarios with 100+ tools across multiple servers

## Relevance

- **Immediate**: MCP cost optimization is economically urgent at scale
- **Architectural**: Validates intent-based gating over eager schema loading
- **Strategic**: Protocol efficiency is a binding constraint, not model capability

## Related Findings

- [HB-260718](../posts/HB-260718-tool-attention-deep-dive.md) - Deep dive on implementation details
- [HB-260725](../posts/HB-260725-tool-attention-impl-hf-skills.md) - Reference implementation + HF Skills ecosystem
- XHS Community: MCP陨落 (MCP decline) discussion validating protocol concerns
